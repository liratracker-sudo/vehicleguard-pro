import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, payment_id, data, company_id } = await req.json();
    
    // Create authenticated client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header missing');
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Service client for admin operations
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized');
    }

    // Get user's company - use company_id if provided for service calls
    let userCompanyId = company_id;
    if (!userCompanyId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.company_id) {
        throw new Error('Company not found');
      }
      userCompanyId = profile.company_id;
    }

    console.log(`Billing management action: ${action} by user ${user.id}`);

    switch (action) {
      case 'update_status': {
        const { status, paid_at } = data;
        
        if (!payment_id || !status) {
          throw new Error('Payment ID and status are required');
        }

        // Update payment status
        const { error } = await supabase
          .from('payment_transactions')
          .update({
            status,
            paid_at: status === 'paid' ? (paid_at || new Date().toISOString()) : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', payment_id)
          .eq('company_id', userCompanyId);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, message: 'Status updated successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete_payment': {
        if (!payment_id) {
          throw new Error('Payment ID is required');
        }

        const { cancellation_reason } = data || {};

        // Soft delete by updating status with cancellation details
        const { error } = await supabase
          .from('payment_transactions')
          .update({
            status: 'cancelled',
            cancellation_reason: cancellation_reason || null,
            cancelled_at: new Date().toISOString(),
            cancelled_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', payment_id)
          .eq('company_id', userCompanyId);

        if (error) throw error;

        console.log(`Payment ${payment_id} cancelled by user ${user.id} with reason: ${cancellation_reason || 'not provided'}`);

        return new Response(
          JSON.stringify({ success: true, message: 'Payment cancelled successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'resend_notification': {
        if (!payment_id) {
          throw new Error('Payment ID is required');
        }

        // Helper function to format currency in Brazilian format (sem R$ - usado no alerta)
        const formatCurrencyBR = (value: number): string => {
          const formatted = value.toFixed(2).replace('.', ',');
          const parts = formatted.split(',');
          parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
          return parts.join(',');
        };

        // Get payment details
        const { data: payment, error: paymentError } = await supabase
          .from('payment_transactions')
          .select('*, clients(*)')
          .eq('id', payment_id)
          .eq('company_id', userCompanyId)
          .single();

        if (paymentError || !payment) {
          throw new Error('Payment not found');
        }

        // Get notification settings and company name
        const { data: notifSettings } = await supabase
          .from('payment_notification_settings')
          .select('template_pre_due, template_post_due, template_on_due')
          .eq('company_id', userCompanyId)
          .single();

        const { data: company } = await supabase
          .from('companies')
          .select('name, domain')
          .eq('id', userCompanyId)
          .single();

        // Use company domain if configured, otherwise fallback (remove protocol and trailing slashes)
        // Sanitiza APP_URL: remove trailing slashes para evitar barra dupla no checkout
        const appUrl = (Deno.env.get('APP_URL') || 'https://vehicleguard-pro.lovable.app').replace(/\/+$/, '');
        // Sanitiza domínio: remove protocolo (http/https) e trailing slashes para evitar URLs duplicadas
        const sanitizedDomain = company?.domain 
          ? company.domain.replace(/^https?:\/+/i, '').replace(/\/+$/, '')
          : null;
        const baseUrl = sanitizedDomain ? `https://${sanitizedDomain}` : appUrl;
        const paymentLink = `${baseUrl}/checkout/${payment.id}`;

        let finalMessage: string;

        // 🤖 SEMPRE usar IA para gerar mensagens - NÃO enviar se IA falhar
        console.log(`[resend_notification] 🤖 Generating AI message for company ${userCompanyId}...`);
        
        try {
          const aiResponse = await supabaseService.functions.invoke('ai-collection', {
            body: {
              action: 'process_specific_payment',
              company_id: userCompanyId,
              payment_id: payment.id
            }
          });

          console.log(`[resend_notification] AI response:`, JSON.stringify(aiResponse.data));

          if (aiResponse.data?.generated_message) {
            finalMessage = `${aiResponse.data.generated_message}\n\n🔗 Acesse seu boleto: ${paymentLink}`;
            console.log(`[resend_notification] ✅ AI message generated successfully`);
          } else {
            const errorMsg = 'IA não retornou mensagem';
            console.error(`[resend_notification] ❌ AI failed:`, errorMsg);
            
            // Criar alerta para a empresa
            await supabaseService.from('system_alerts').insert({
              company_id: userCompanyId,
              type: 'ai_failure',
              message: `❌ Falha no sistema de IA: A cobrança para ${payment.clients?.name || 'Cliente'} (R$ ${formatCurrencyBR(Number(payment.amount))}) NÃO foi enviada. Erro: ${errorMsg}`,
              severity: 'error',
              created_at: new Date().toISOString()
            });
            
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: `Falha no sistema de IA: ${errorMsg}. Cobrança NÃO foi enviada. Um alerta foi criado.`
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (aiError) {
          const errorMsg = aiError instanceof Error ? aiError.message : String(aiError);
          console.error(`[resend_notification] ❌ AI error:`, errorMsg);
          
          // Criar alerta para a empresa
          await supabaseService.from('system_alerts').insert({
            company_id: userCompanyId,
            type: 'ai_failure',
            message: `❌ Falha no sistema de IA: A cobrança para ${payment.clients?.name || 'Cliente'} (R$ ${formatCurrencyBR(Number(payment.amount))}) NÃO foi enviada. Erro: ${errorMsg}`,
            severity: 'error',
            created_at: new Date().toISOString()
          });
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Falha no sistema de IA: ${errorMsg}. Cobrança NÃO foi enviada. Um alerta foi criado.`
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Send notification via WhatsApp
        console.log(`[resend_notification] Sending AI-generated message to ${payment.clients?.phone}`);
        
        const notificationResponse = await supabase.functions.invoke('notify-whatsapp', {
          body: {
            client_id: payment.client_id,
            message: finalMessage,
            payment_id: payment_id,
            phone: payment.clients?.phone,
            linkPreview: false
          }
        });

        let success = true;
        let errMsg = '';
        if (notificationResponse.error) {
          success = false;
          errMsg = notificationResponse.error.message || 'Falha ao chamar notify-whatsapp';
        } else if (!notificationResponse.data?.success) {
          success = false;
          errMsg = notificationResponse.data?.error || 'Falha ao enviar notificação via WhatsApp';
        }

        return new Response(
          JSON.stringify({ 
            success, 
            message: success ? 'Notification sent successfully' : errMsg
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'generate_second_copy': {
        if (!payment_id) {
          throw new Error('Payment ID is required');
        }

        // Get payment details
        const { data: payment, error: paymentError } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('id', payment_id)
          .eq('company_id', userCompanyId)
          .single();

        if (paymentError || !payment) {
          throw new Error('Payment not found');
        }

        // If external payment exists, try to get updated data from Asaas
        if (payment.external_id) {
          try {
            const asaasResponse = await supabaseService.functions.invoke('asaas-integration', {
              body: {
                action: 'get_charge',
                company_id: userCompanyId,
                data: { chargeId: payment.external_id }
              }
            });

            if (asaasResponse.data?.success && asaasResponse.data?.charge) {
              const charge = asaasResponse.data.charge;
              
              // Update payment with fresh data
              await supabase
                .from('payment_transactions')
                .update({
                  payment_url: charge.invoiceUrl,
                  barcode: charge.bankSlipUrl,
                  pix_code: charge.pixCode,
                  updated_at: new Date().toISOString()
                })
                .eq('id', payment_id);

              return new Response(
                JSON.stringify({ 
                  success: true, 
                  message: 'Second copy generated',
                  data: {
                    payment_url: charge.invoiceUrl,
                    barcode: charge.bankSlipUrl,
                    pix_code: charge.pixCode
                  }
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } catch (asaasError) {
            console.error('Asaas integration error:', asaasError);
          }
        }

        // Fallback: return existing payment data
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Payment data retrieved',
            data: {
              payment_url: payment.payment_url,
              barcode: payment.barcode,
              pix_code: payment.pix_code
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_company_balance': {
        // Get company's payment summary
        const { data: payments, error: paymentsError } = await supabase
          .from('payment_transactions')
          .select('amount, status, due_date')
          .eq('company_id', userCompanyId);

        if (paymentsError) throw paymentsError;

        const summary = {
          total_received: 0,
          total_pending: 0,
          total_overdue: 0,
          total_balance: 0
        };

        const today = new Date();
        
        payments?.forEach(payment => {
          const amount = Number(payment.amount);
          
          switch (payment.status) {
            case 'paid':
              summary.total_received += amount;
              break;
            case 'pending':
              if (payment.due_date && new Date(payment.due_date) < today) {
                summary.total_overdue += amount;
              } else {
                summary.total_pending += amount;
              }
              break;
            case 'overdue':
              summary.total_overdue += amount;
              break;
          }
        });

        summary.total_balance = summary.total_pending + summary.total_overdue;

        return new Response(
          JSON.stringify({ success: true, data: summary }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete_permanently': {
        if (!payment_id) {
          throw new Error('Payment ID is required');
        }

        // First, delete related payment_notifications to avoid FK constraint violation
        const { error: notifError } = await supabaseService
          .from('payment_notifications')
          .delete()
          .eq('payment_id', payment_id);

        if (notifError) {
          console.error('Error deleting payment notifications:', notifError);
          // Continue anyway - notifications might not exist
        }

        // Then permanently delete the payment from database
        const { error } = await supabase
          .from('payment_transactions')
          .delete()
          .eq('id', payment_id)
          .eq('company_id', userCompanyId);

        if (error) throw error;

        console.log(`Payment ${payment_id} permanently deleted by user ${user.id}`);

        return new Response(
          JSON.stringify({ success: true, message: 'Payment deleted permanently' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'protest_payment': {
        if (!payment_id) {
          throw new Error('Payment ID is required');
        }

        // Buscar cobrança
        const { data: payment, error: paymentError } = await supabase
          .from('payment_transactions')
          .select('id, due_date, status, protested_at')
          .eq('id', payment_id)
          .eq('company_id', userCompanyId)
          .single();

        if (paymentError || !payment) {
          throw new Error('Cobrança não encontrada');
        }

        // Validar se já está protestada
        if (payment.protested_at) {
          throw new Error('Esta cobrança já foi protestada');
        }

        // Validar status (só overdue pode ser protestado)
        if (payment.status !== 'overdue') {
          throw new Error('Apenas cobranças vencidas podem ser protestadas');
        }

        // Validar regra de 15 dias
        const dueDate = new Date(payment.due_date);
        const today = new Date();
        const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 15) {
          throw new Error(`Cobrança precisa estar vencida há pelo menos 15 dias. Dias em atraso: ${diffDays}`);
        }

        // Marcar como protestada
        const { error: updateError } = await supabase
          .from('payment_transactions')
          .update({
            protested_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', payment_id)
          .eq('company_id', userCompanyId);

        if (updateError) throw updateError;

        // Cancelar notificações pendentes usando service client
        await supabaseService
          .from('payment_notifications')
          .update({
            status: 'skipped',
            last_error: 'Cobrança protestada'
          })
          .eq('payment_id', payment_id)
          .eq('status', 'pending');

        console.log(`Payment ${payment_id} protested by user ${user.id}`);

        return new Response(
          JSON.stringify({ success: true, message: 'Cobrança protestada com sucesso' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'undo_protest': {
        if (!payment_id) {
          throw new Error('Payment ID is required');
        }

        // Verificar se a cobrança está protestada
        const { data: payment, error: paymentError } = await supabase
          .from('payment_transactions')
          .select('id, protested_at')
          .eq('id', payment_id)
          .eq('company_id', userCompanyId)
          .single();

        if (paymentError || !payment) {
          throw new Error('Cobrança não encontrada');
        }

        if (!payment.protested_at) {
          throw new Error('Esta cobrança não está protestada');
        }

        // Remover protesto
        const { error } = await supabase
          .from('payment_transactions')
          .update({
            protested_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', payment_id)
          .eq('company_id', userCompanyId);

        if (error) throw error;

        console.log(`Protest removed from payment ${payment_id} by user ${user.id}`);

        return new Response(
          JSON.stringify({ success: true, message: 'Protesto removido com sucesso' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_due_date': {
        const { new_due_date, reason } = data || {};
        
        if (!payment_id || !new_due_date) {
          throw new Error('Payment ID e nova data são obrigatórios');
        }

        // Validar que a nova data não está no passado
        const newDate = new Date(new_due_date);
        newDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (newDate < today) {
          throw new Error('A nova data de vencimento não pode estar no passado');
        }

        // Buscar cobrança
        const { data: payment, error: paymentError } = await supabase
          .from('payment_transactions')
          .select('id, external_id, due_date, status, client_id, protested_at')
          .eq('id', payment_id)
          .eq('company_id', userCompanyId)
          .single();

        if (paymentError || !payment) {
          throw new Error('Cobrança não encontrada');
        }

        // Não permitir alterar cobranças pagas ou canceladas
        if (payment.status === 'paid') {
          throw new Error('Não é possível alterar vencimento de cobranças pagas');
        }
        if (payment.status === 'cancelled') {
          throw new Error('Não é possível alterar vencimento de cobranças canceladas');
        }
        if (payment.protested_at) {
          throw new Error('Não é possível alterar vencimento de cobranças protestadas');
        }

        // 1. Atualizar no banco local
        const { error: updateError } = await supabase
          .from('payment_transactions')
          .update({
            due_date: new_due_date,
            status: 'pending', // Resetar para pending já que nova data é futura
            updated_at: new Date().toISOString()
          })
          .eq('id', payment_id)
          .eq('company_id', userCompanyId);

        if (updateError) throw updateError;

        // 2. Se tiver cobrança no Asaas, atualizar lá também
        if (payment.external_id) {
          try {
            console.log(`Atualizando cobrança ${payment.external_id} no Asaas para nova data ${new_due_date}`);
            
            const asaasResponse = await supabaseService.functions.invoke('asaas-integration', {
              body: {
                action: 'update_charge',
                company_id: userCompanyId,
                data: {
                  chargeId: payment.external_id,
                  dueDate: new_due_date
                }
              }
            });

            if (asaasResponse.error) {
              console.error('Erro ao atualizar no Asaas:', asaasResponse.error);
              // Continuar mesmo se Asaas falhar - banco local já foi atualizado
            } else {
              console.log('Cobrança atualizada no Asaas com sucesso');
            }
          } catch (asaasError) {
            console.error('Erro na chamada ao Asaas:', asaasError);
            // Não falhar a operação por causa do Asaas
          }
        }

        // 3. Reagendar notificações - deletar pendentes e criar novas
        const { error: deleteNotifError } = await supabaseService
          .from('payment_notifications')
          .delete()
          .eq('payment_id', payment_id)
          .eq('status', 'pending');

        if (deleteNotifError) {
          console.error('Erro ao deletar notificações pendentes:', deleteNotifError);
        }

        // Buscar configurações de notificação para reagendar
        const { data: notifSettings } = await supabase
          .from('payment_notification_settings')
          .select('days_before, days_after, on_due_date, enabled')
          .eq('company_id', userCompanyId)
          .single();

        if (notifSettings?.enabled) {
          const notificationsToCreate: any[] = [];
          const dueDate = new Date(new_due_date);

          // Notificações antes do vencimento
          if (notifSettings.days_before && Array.isArray(notifSettings.days_before)) {
            notifSettings.days_before.forEach((days: number) => {
              const scheduledDate = new Date(dueDate);
              scheduledDate.setDate(scheduledDate.getDate() - days);
              if (scheduledDate >= today) {
                notificationsToCreate.push({
                  payment_id: payment_id,
                  company_id: userCompanyId,
                  notification_type: 'pre_due',
                  scheduled_for: scheduledDate.toISOString(),
                  status: 'pending'
                });
              }
            });
          }

          // Notificação no dia do vencimento
          if (notifSettings.on_due_date && dueDate >= today) {
            notificationsToCreate.push({
              payment_id: payment_id,
              company_id: userCompanyId,
              notification_type: 'on_due',
              scheduled_for: new_due_date,
              status: 'pending'
            });
          }

          // Notificações após vencimento
          if (notifSettings.days_after && Array.isArray(notifSettings.days_after)) {
            notifSettings.days_after.forEach((days: number) => {
              const scheduledDate = new Date(dueDate);
              scheduledDate.setDate(scheduledDate.getDate() + days);
              notificationsToCreate.push({
                payment_id: payment_id,
                company_id: userCompanyId,
                notification_type: 'post_due',
                scheduled_for: scheduledDate.toISOString(),
                status: 'pending'
              });
            });
          }

          if (notificationsToCreate.length > 0) {
            const { error: insertNotifError } = await supabaseService
              .from('payment_notifications')
              .insert(notificationsToCreate);

            if (insertNotifError) {
              console.error('Erro ao criar novas notificações:', insertNotifError);
            } else {
              console.log(`${notificationsToCreate.length} notificações reagendadas`);
            }
          }
        }

        console.log(`Payment ${payment_id} due date updated to ${new_due_date} by user ${user.id}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Vencimento atualizado com sucesso',
            new_due_date
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in billing-management function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});