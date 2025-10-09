import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processando lembretes agendados...');

    // Buscar lembretes pendentes que devem ser enviados
    const now = new Date().toISOString();
    const { data: pendingReminders, error: fetchError } = await supabase
      .from('scheduled_reminders')
      .select(`
        *,
        companies (
          id,
          name
        ),
        whatsapp_settings!inner (
          instance_url,
          api_token,
          instance_name,
          is_active
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .eq('whatsapp_settings.is_active', true)
      .limit(50);

    if (fetchError) {
      console.error('Erro ao buscar lembretes:', fetchError);
      throw fetchError;
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      console.log('Nenhum lembrete pendente para processar');
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Encontrados ${pendingReminders.length} lembretes para processar`);

    let processed = 0;
    let failed = 0;

    // Processar cada lembrete
    for (const reminder of pendingReminders) {
      try {
        const whatsappSettings = Array.isArray(reminder.whatsapp_settings) 
          ? reminder.whatsapp_settings[0] 
          : reminder.whatsapp_settings;

        if (!whatsappSettings) {
          console.error(`WhatsApp não configurado para empresa ${reminder.company_id}`);
          await supabase
            .from('scheduled_reminders')
            .update({
              status: 'failed',
              error_message: 'WhatsApp não configurado',
              sent_at: new Date().toISOString()
            })
            .eq('id', reminder.id);
          failed++;
          continue;
        }

        // Se for cobrança agendada, executar a cobrança
        if (reminder.action_type === 'collection' && reminder.metadata?.payment_id) {
          console.log(`Executando cobrança agendada: ${reminder.metadata.payment_id}`);
          
          await supabase.functions.invoke('ai-collection', {
            body: {
              action: 'process_specific_payment',
              company_id: reminder.company_id,
              payment_id: reminder.metadata.payment_id
            }
          });

          // Notificar gestor que a cobrança foi enviada
          await supabase.functions.invoke('whatsapp-evolution', {
            body: {
              action: 'sendText',
              instance_url: whatsappSettings.instance_url,
              api_token: whatsappSettings.api_token,
              instance_name: whatsappSettings.instance_name,
              number: reminder.manager_phone,
              message: `✅ Cobrança agendada executada com sucesso!`,
              company_id: reminder.company_id
            }
          });
        } else {
          // Enviar lembrete via WhatsApp
          await supabase.functions.invoke('whatsapp-evolution', {
            body: {
              action: 'sendText',
              instance_url: whatsappSettings.instance_url,
              api_token: whatsappSettings.api_token,
              instance_name: whatsappSettings.instance_name,
              number: reminder.manager_phone,
              message: `🔔 *Lembrete Agendado*\n\n${reminder.reminder_text}`,
              company_id: reminder.company_id
            }
          });
        }

        // Atualizar status para enviado
        await supabase
          .from('scheduled_reminders')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', reminder.id);

        processed++;
        console.log(`Lembrete ${reminder.id} processado com sucesso`);

      } catch (error) {
        console.error(`Erro ao processar lembrete ${reminder.id}:`, error);
        
        // Atualizar status para falha
        await supabase
          .from('scheduled_reminders')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Erro desconhecido',
            sent_at: new Date().toISOString()
          })
          .eq('id', reminder.id);

        failed++;
      }
    }

    console.log(`Processamento concluído. Processados: ${processed}, Falhas: ${failed}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed,
        failed,
        total: pendingReminders.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no processamento de lembretes:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
