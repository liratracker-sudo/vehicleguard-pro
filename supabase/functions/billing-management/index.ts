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

        // Soft delete by updating status
        const { error } = await supabase
          .from('payment_transactions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', payment_id)
          .eq('company_id', userCompanyId);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, message: 'Payment cancelled successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'resend_notification': {
        if (!payment_id) {
          throw new Error('Payment ID is required');
        }

        // Helper function to format date in Brazilian format (DD/MM/YYYY)
        const formatDateBR = (date: Date): string => {
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const year = date.getFullYear();
          return `${day}/${month}/${year}`;
        };

        // Helper function to format currency in Brazilian format (R$ X.XXX,XX)
        const formatCurrencyBR = (value: number): string => {
          const formatted = value.toFixed(2).replace('.', ',');
          const parts = formatted.split(',');
          parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
          return `R$ ${parts.join(',')}`;
        };

        // Helper function to calculate days difference correctly (considering Brasília timezone)
        const calculateDaysDiff = (dueDate: Date): number => {
          const now = new Date();
          
          // Normalize due_date to midnight UTC
          const dueDateOnly = new Date(Date.UTC(
            dueDate.getUTCFullYear(), 
            dueDate.getUTCMonth(), 
            dueDate.getUTCDate()
          ));
          
          // Get current date in Brasília (UTC-3)
          const brazilOffset = -3 * 60 * 60 * 1000;
          const nowInBrazil = new Date(now.getTime() + brazilOffset);
          const todayOnly = new Date(Date.UTC(
            nowInBrazil.getUTCFullYear(), 
            nowInBrazil.getUTCMonth(), 
            nowInBrazil.getUTCDate()
          ));
          
          const diffMs = dueDateOnly.getTime() - todayOnly.getTime();
          return Math.round(diffMs / (1000 * 60 * 60 * 24));
        };

        // Helper function to format days text dynamically
        const formatDaysText = (daysDiff: number): string => {
          if (daysDiff === 0) return 'hoje';
          if (daysDiff === 1) return 'amanhã';
          if (daysDiff === -1) return 'ontem';
          if (daysDiff > 0) return `em ${daysDiff} dias`;
          return `há ${Math.abs(daysDiff)} dias`;
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
          .select('template_pre_due')
          .eq('company_id', userCompanyId)
          .single();

        const { data: company } = await supabase
          .from('companies')
          .select('name, domain')
          .eq('id', userCompanyId)
          .single();

        // Use company domain if configured, otherwise fallback
        const appUrl = Deno.env.get('APP_URL') || 'https://vehicleguard-pro.lovable.app';
        const baseUrl = company?.domain 
          ? `https://${company.domain.replace(/^https?:\/\//, '')}` 
          : appUrl;
        const paymentLink = `${baseUrl}/checkout/${payment.id}`;

        // Use template from settings or default (without link - will be sent separately)
        const template = notifSettings?.template_pre_due || `📋 *Lembrete de Pagamento*

Olá *{{cliente}}*!

Sua fatura de *{{valor}}* vence em *{{vencimento}}*.

_{{empresa}}_`;

        const dueDate = new Date(payment.due_date);
        const daysDiff = calculateDaysDiff(dueDate);
        const daysText = formatDaysText(daysDiff);

        // Build message using template (link será incluído no final)
        const messageWithoutLink = template
          .replace(/\{\{cliente\}\}/g, payment.clients?.name || 'Cliente')
          .replace(/\{\{valor\}\}/g, formatCurrencyBR(Number(payment.amount)))
          .replace(/\{\{vencimento\}\}/g, formatDateBR(dueDate))
          .replace(/\{\{dias\}\}/g, daysText) // Now uses "hoje", "amanhã", "em X dias", etc.
          .replace(/\{\{link_pagamento\}\}/g, '')
          .replace(/\{\{empresa\}\}/g, company?.name || 'Sistema')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        // Unificar mensagem: texto + link em uma só mensagem
        const fullMessage = `${messageWithoutLink}\n\n🔗 Acesse seu boleto: ${paymentLink}`;

        // Send notification via WhatsApp - UMA única mensagem com linkPreview: false
        const notificationResponse = await supabase.functions.invoke('notify-whatsapp', {
          body: {
            client_id: payment.client_id,
            message: fullMessage,
            payment_id: payment_id,
            phone: payment.clients?.phone,
            linkPreview: false  // Desabilita preview do link
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
          JSON.stringify({ success, message: success ? 'Notification sent successfully' : errMsg }),
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

        // Permanently delete the payment from database
        const { error } = await supabase
          .from('payment_transactions')
          .delete()
          .eq('id', payment_id)
          .eq('company_id', userCompanyId);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, message: 'Payment deleted permanently' }),
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