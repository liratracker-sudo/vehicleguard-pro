import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, company_id, payment_id } = await req.json();
    
    console.log('AI Collection action:', { action, company_id, payment_id });

    // Processar pagamento específico (para comando do gestor ou sistema de notificações)
    if (action === 'process_specific_payment') {
      const { data: payment } = await supabase
        .from('payment_transactions')
        .select(`
          *,
          clients:client_id(*)
        `)
        .eq('id', payment_id)
        .single();

      if (!payment) {
        throw new Error('Pagamento não encontrado');
      }

      const client = payment.clients;
      
      if (!client || !client.phone) {
        throw new Error('Cliente sem telefone cadastrado');
      }

      // Buscar configurações de IA
      const { data: aiSettings } = await supabase
        .from('ai_collection_settings')
        .select('*')
        .eq('company_id', payment.company_id)
        .eq('is_active', true)
        .single();

      if (!aiSettings) {
        throw new Error('Configurações de IA não encontradas ou inativas');
      }

      // Calcular dias de atraso
      const daysOverdue = Math.floor(
        (new Date().getTime() - new Date(payment.due_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Buscar informações da empresa
      const { data: companyInfo } = await supabase
        .from('companies')
        .select('name')
        .eq('id', payment.company_id)
        .single();

      const companyName = companyInfo?.name || 'Lira Tracker';

      // Preparar prompt para a IA
      const prompt = `Cliente: ${client.name}
Valor: R$ ${payment.amount}
Data de vencimento: ${new Date(payment.due_date).toLocaleDateString('pt-BR')}
Dias de atraso: ${daysOverdue}
Status do pagamento: ${payment.status}
Nome da empresa: ${companyName}

Gere uma mensagem de cobrança educada e profissional para enviar via WhatsApp. 
IMPORTANTE: Termine a mensagem com "Atenciosamente, ${companyName}" sem incluir nome de atendente ou placeholders vazios.`;

      // Chamar OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: aiSettings.openai_model || 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: `${aiSettings.system_prompt}\n\nIMPORTANTE: Nunca inclua placeholders como [Seu Nome], [Nome da Empresa], [Nome do Atendente] ou similares. Use o nome da empresa fornecido no contexto.` 
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 500,
          temperature: 0.7
        }),
      });

      const aiData = await response.json();
      
      if (!response.ok) {
        throw new Error(aiData.error?.message || 'Erro ao chamar OpenAI API');
      }

      const generatedMessage = aiData.choices[0].message.content;
      const usage = aiData.usage;

      // Salvar log da IA
      await supabase.from('ai_collection_logs').insert({
        company_id: payment.company_id,
        payment_id: payment.id,
        client_id: client.id,
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        model_used: aiSettings.openai_model || 'gpt-4o-mini',
        generated_message: generatedMessage,
        sent_successfully: false // Will be updated by billing-notifications if sent
      });

      // Return generated message without sending
      // The billing-notifications function will handle the actual sending
      return new Response(
        JSON.stringify({ 
          success: true,
          generated_message: generatedMessage,
          client_phone: client.phone,
          company_id: payment.company_id,
          client_id: client.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Cobrança enviada com sucesso',
          generated_message: generatedMessage
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'process_overdue_clients') {
      // Buscar clientes inadimplentes
      const { data: overduePayments } = await supabase
        .from('payment_transactions')
        .select(`
          *,
          clients:client_id(*)
        `)
        .eq('company_id', company_id)
        .eq('status', 'overdue')
        .order('due_date', { ascending: true })
        .limit(10);

      if (!overduePayments || overduePayments.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'Nenhum cliente inadimplente encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar configurações de IA
      const { data: aiSettings } = await supabase
        .from('ai_collection_settings')
        .select('*')
        .eq('company_id', company_id)
        .eq('is_active', true)
        .single();

      if (!aiSettings) {
        throw new Error('Configurações de IA não encontradas ou inativas');
      }

      const results = [];

      // Processar cada pagamento
      for (const payment of overduePayments) {
        const client = payment.clients;
        
        if (!client || !client.phone) {
          console.log(`Cliente sem telefone: ${payment.id}`);
          continue;
        }

        // Calcular dias de atraso
        const daysOverdue = Math.floor(
          (new Date().getTime() - new Date(payment.due_date).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Buscar informações da empresa
        const { data: companyInfo } = await supabase
          .from('companies')
          .select('name')
          .eq('id', company_id)
          .single();

        const companyName = companyInfo?.name || 'Lira Tracker';

        // Preparar prompt para a IA
        const prompt = `Cliente: ${client.name}
Valor: R$ ${payment.amount}
Data de vencimento: ${new Date(payment.due_date).toLocaleDateString('pt-BR')}
Dias de atraso: ${daysOverdue}
Status do pagamento: ${payment.status}
Nome da empresa: ${companyName}

Gere uma mensagem de cobrança educada e profissional para enviar via WhatsApp. 
IMPORTANTE: Termine a mensagem com "Atenciosamente, ${companyName}" sem incluir nome de atendente ou placeholders vazios.`;

        try {
          // Chamar OpenAI API
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
          body: JSON.stringify({
            model: aiSettings.openai_model || 'gpt-4o-mini',
            messages: [
              { 
                role: 'system', 
                content: `${aiSettings.system_prompt}\n\nIMPORTANTE: Nunca inclua placeholders como [Seu Nome], [Nome da Empresa], [Nome do Atendente] ou similares. Use o nome da empresa fornecido no contexto.` 
              },
              { role: 'user', content: prompt }
            ],
            max_tokens: 500,
            temperature: 0.7
          }),
          });

          const aiData = await response.json();
          
          if (!response.ok) {
            throw new Error(aiData.error?.message || 'Erro ao chamar OpenAI API');
          }

          const generatedMessage = aiData.choices[0].message.content;
          const usage = aiData.usage;

          // Enviar via WhatsApp (apenas UMA vez)
          const { data: whatsappSettings } = await supabase
            .from('whatsapp_settings')
            .select('*')
            .eq('company_id', company_id)
            .eq('is_active', true)
            .single();

          let messageSent = false;
          if (whatsappSettings) {
            const whatsappResult = await supabase.functions.invoke('whatsapp-evolution', {
              body: {
                action: 'sendText',
                instance_url: whatsappSettings.instance_url,
                api_token: whatsappSettings.api_token,
                instance_name: whatsappSettings.instance_name,
                number: client.phone,
                message: generatedMessage,
                company_id: company_id,
                client_id: client.id
              }
            });

            messageSent = whatsappResult.data?.success || false;
          }

          // Salvar log da IA após enviar
          await supabase.from('ai_collection_logs').insert({
            company_id,
            payment_id: payment.id,
            client_id: client.id,
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
            model_used: aiSettings.openai_model || 'gpt-4o-mini',
            generated_message: generatedMessage,
            sent_successfully: messageSent
          });

          results.push({
            payment_id: payment.id,
            client_name: client.name,
            success: messageSent,
            message: generatedMessage
          });

        } catch (error) {
          console.error(`Erro ao processar pagamento ${payment.id}:`, error);
          
          // Salvar erro no log
          await supabase.from('ai_collection_logs').insert({
            company_id,
            payment_id: payment.id,
            client_id: client.id,
            model_used: aiSettings.openai_model || 'gpt-4o-mini',
            sent_successfully: false,
            error_message: error instanceof Error ? error.message : String(error)
          });

          results.push({
            payment_id: payment.id,
            client_name: client.name,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: results.length,
          results 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'generate_weekly_report') {
      // Buscar configurações do relatório
      const { data: reportSettings } = await supabase
        .from('ai_weekly_reports')
        .select('*')
        .eq('company_id', company_id)
        .eq('is_active', true)
        .single();

      if (!reportSettings || !reportSettings.manager_phone) {
        throw new Error('Configurações de relatório não encontradas ou telefone do gestor não configurado');
      }

      // Buscar dados dos últimos 7 dias
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentPayments } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('company_id', company_id)
        .gte('created_at', sevenDaysAgo.toISOString());

      const totalReceived = recentPayments
        ?.filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const totalPending = recentPayments
        ?.filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const totalOverdue = recentPayments
        ?.filter(p => p.status === 'overdue')
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Buscar configurações de IA
      const { data: aiSettings } = await supabase
        .from('ai_collection_settings')
        .select('*')
        .eq('company_id', company_id)
        .eq('is_active', true)
        .single();

      if (!aiSettings) {
        throw new Error('Configurações de IA não encontradas');
      }

      // Gerar relatório com IA
      const prompt = `Gere um relatório executivo resumido da semana com os seguintes dados:
- Total recebido: R$ ${totalReceived.toFixed(2)}
- Total pendente: R$ ${totalPending.toFixed(2)}
- Total em atraso: R$ ${totalOverdue.toFixed(2)}
- Total de cobranças: ${recentPayments?.length || 0}

O relatório deve ser profissional e conciso para envio via WhatsApp ao gestor.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: aiSettings.openai_model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Você é um assistente financeiro que gera relatórios executivos concisos.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 800,
          temperature: 0.5
        }),
      });

      const aiData = await response.json();
      
      if (!response.ok) {
        throw new Error(aiData.error?.message || 'Erro ao gerar relatório');
      }

      const reportMessage = aiData.choices[0].message.content;

      // Enviar relatório via WhatsApp
      const { data: whatsappSettings } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('company_id', company_id)
        .eq('is_active', true)
        .single();

      if (whatsappSettings && reportSettings.manager_phones && reportSettings.manager_phones.length > 0) {
        // Enviar para todos os gestores cadastrados
        const sendPromises = reportSettings.manager_phones.map(phone => 
          supabase.functions.invoke('whatsapp-evolution', {
            body: {
              action: 'sendText',
              instance_url: whatsappSettings.instance_url,
              api_token: whatsappSettings.api_token,
              instance_name: whatsappSettings.instance_name,
              number: phone,
              message: reportMessage
            }
          })
        );
        
        await Promise.all(sendPromises);

        // Atualizar última execução
        await supabase
          .from('ai_weekly_reports')
          .update({ last_sent_at: new Date().toISOString() })
          .eq('company_id', company_id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Relatório gerado e enviado com sucesso',
          report: reportMessage
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função AI Collection:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});