import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { nowInBrasilia, toISODateTimeBR } from "../_shared/timezone.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Timeout de 60 segundos para toda a função
const FUNCTION_TIMEOUT_MS = 60000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Criar promise de timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Function timeout after 60s')), FUNCTION_TIMEOUT_MS);
  });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processando lembretes agendados...');

    // Buscar lembretes pendentes que devem ser enviados
    const now = new Date().toISOString();
    console.log('Data/hora atual (UTC):', now);
    
    // Executar com timeout
    const result = await Promise.race([
      processReminders(supabase, now),
      timeoutPromise
    ]);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no processamento de lembretes:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        timeout: error instanceof Error && error.message.includes('timeout')
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Função principal de processamento
async function processReminders(supabase: any, now: string) {
  const { data: pendingReminders, error: fetchError } = await supabase
    .from('scheduled_reminders')
    .select(`
      *,
      companies (
        id,
        name
      )
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .limit(50);
  
  console.log('Consulta executada. Lembretes encontrados:', pendingReminders?.length || 0);

  if (fetchError) {
    console.error('Erro ao buscar lembretes:', fetchError);
    throw fetchError;
  }

  if (!pendingReminders || pendingReminders.length === 0) {
    console.log('Nenhum lembrete pendente para processar');
    return { success: true, processed: 0 };
  }

  console.log(`Encontrados ${pendingReminders.length} lembretes para processar`);

  // PRÉ-CARREGAR configurações de WhatsApp de todas as empresas de uma vez
  const companyIds = [...new Set(pendingReminders.map((r: any) => r.company_id))];
  const { data: allWhatsappSettings, error: whatsappBatchError } = await supabase
    .from('whatsapp_settings')
    .select('*')
    .in('company_id', companyIds)
    .eq('is_active', true);

  if (whatsappBatchError) {
    console.error('Erro ao buscar WhatsApp settings em batch:', whatsappBatchError);
  }

  // Criar mapa de configurações por empresa
  const whatsappSettingsMap = new Map<string, any>();
  if (allWhatsappSettings) {
    for (const settings of allWhatsappSettings) {
      whatsappSettingsMap.set(settings.company_id, settings);
    }
  }
  console.log(`📊 WhatsApp settings carregados para ${whatsappSettingsMap.size}/${companyIds.length} empresas`);

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  // Processar cada lembrete
  for (const reminder of pendingReminders) {
    try {
      // Usar settings do cache
      const whatsappSettings = whatsappSettingsMap.get(reminder.company_id);

      if (!whatsappSettings) {
        console.warn(`⏭️ WhatsApp não configurado para empresa ${reminder.company_id} - skipping`);
        await supabase
          .from('scheduled_reminders')
          .update({
            status: 'failed',
            error_message: 'WhatsApp não configurado ou inativo',
            sent_at: new Date().toISOString()
          })
          .eq('id', reminder.id);
        skipped++;
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
            message: `✅ Cobrança agendada executada com sucesso!\nHorário: ${toISODateTimeBR(nowInBrasilia())}`,
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
      console.log(`✅ Lembrete ${reminder.id} processado com sucesso`);

    } catch (error) {
      console.error(`❌ Erro ao processar lembrete ${reminder.id}:`, error);
      
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

  console.log(`Processamento concluído. Processados: ${processed}, Falhas: ${failed}, Skipped: ${skipped}`);

  return { 
    success: true, 
    processed,
    failed,
    skipped,
    total: pendingReminders.length
  };
}
