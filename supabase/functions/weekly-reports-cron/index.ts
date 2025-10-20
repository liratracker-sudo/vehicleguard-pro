import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('🔄 Iniciando processamento de relatórios semanais automáticos...');
    
    // Obter data e hora atual no Brasil
    const now = new Date();
    const brasilTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
    const currentDay = brasilTime.getDay(); // 0 = Domingo, 1 = Segunda, etc.
    const currentHour = brasilTime.getHours();
    const currentMinute = brasilTime.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:00`;
    const today = brasilTime.toISOString().split('T')[0];
    
    console.log(`📅 Data/Hora Brasil: ${brasilTime.toISOString()}, Dia da semana: ${currentDay}, Horário: ${currentTime}`);
    
    // Converter domingo (0) para 7 para compatibilidade com a tabela
    const dayOfWeek = currentDay === 0 ? 7 : currentDay;
    
    // Buscar relatórios ativos que devem ser enviados hoje
    const { data: reports, error: reportsError } = await supabase
      .from('ai_weekly_reports')
      .select('*')
      .eq('is_active', true)
      .eq('schedule_day', dayOfWeek)
      .not('manager_phones', 'is', null);
    
    if (reportsError) {
      console.error('❌ Erro ao buscar relatórios:', reportsError);
      throw reportsError;
    }
    
    if (!reports || reports.length === 0) {
      console.log(`ℹ️ Nenhum relatório ativo encontrado para o dia ${dayOfWeek}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Nenhum relatório para processar hoje (dia ${dayOfWeek})`,
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`📋 Encontrados ${reports.length} relatórios ativos para hoje`);
    
    let processed = 0;
    let errors = 0;
    
    for (const report of reports) {
      try {
        // Verificar se é o horário correto (com margem de 30 minutos)
        const scheduleTime = report.schedule_time; // formato HH:MM:SS
        const [scheduleHour, scheduleMinute] = scheduleTime.split(':').map(Number);
        
        const scheduleMinutes = scheduleHour * 60 + scheduleMinute;
        const currentMinutes = currentHour * 60 + currentMinute;
        const timeDiff = Math.abs(currentMinutes - scheduleMinutes);
        
        // Verificar se está dentro da janela de 30 minutos
        if (timeDiff > 30) {
          console.log(`⏰ Relatório ${report.id}: Fora do horário (agendado: ${scheduleTime}, atual: ${currentTime})`);
          continue;
        }
        
        // Verificar se já foi enviado hoje
        if (report.last_sent_at) {
          const lastSentDate = new Date(report.last_sent_at).toISOString().split('T')[0];
          if (lastSentDate === today) {
            console.log(`✅ Relatório ${report.id}: Já enviado hoje`);
            continue;
          }
        }
        
        console.log(`📤 Processando relatório para empresa ${report.company_id}...`);
        
        // Chamar a função de geração de relatório
        const { data: reportResult, error: reportError } = await supabase.functions.invoke('ai-collection', {
          body: {
            action: 'generate_weekly_report',
            company_id: report.company_id
          }
        });
        
        if (reportError) {
          console.error(`❌ Erro ao gerar relatório para empresa ${report.company_id}:`, reportError);
          errors++;
          continue;
        }
        
        console.log(`✅ Relatório enviado com sucesso para empresa ${report.company_id}`);
        processed++;
        
      } catch (error) {
        console.error(`❌ Erro ao processar relatório ${report.id}:`, error);
        errors++;
      }
    }
    
    console.log(`🏁 Processamento concluído. Processados: ${processed}, Erros: ${errors}`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Processamento concluído`,
        processed,
        errors,
        total_reports: reports.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Erro crítico no processamento de relatórios semanais:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});