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

      // Buscar configurações de IA (usar padrão se não existir)
      const { data: aiSettings } = await supabase
        .from('ai_collection_settings')
        .select('*')
        .eq('company_id', payment.company_id)
        .eq('is_active', true)
        .maybeSingle();

      // Usar configurações padrão se não estiverem configuradas
      const settings = aiSettings || {
        openai_model: 'gpt-4o-mini',
        system_prompt: 'Você é um assistente de comunicação de cobrança para um SaaS. Sua prioridade é a recuperação financeira mantendo um relacionamento cordial com o cliente.'
      };

      console.log('Usando configurações de IA:', aiSettings ? 'personalizadas' : 'padrão');

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

      // Determinar histórico de pagamento
      const { data: pastPayments } = await supabase
        .from('payment_transactions')
        .select('status, due_date, paid_at')
        .eq('client_id', client.id)
        .eq('company_id', payment.company_id)
        .neq('id', payment.id)
        .order('due_date', { ascending: false })
        .limit(5);

      let paymentHistory = 'Primeiro Atraso';
      if (pastPayments && pastPayments.length > 0) {
        const latePayments = pastPayments.filter(p => {
          if (p.paid_at && p.due_date) {
            return new Date(p.paid_at) > new Date(p.due_date);
          }
          return false;
        });
        paymentHistory = latePayments.length > 1 ? 'Atrasos Recorrentes' : 'Histórico Regular';
      }

      // Determinar tom baseado em dias de atraso
      let toneInstruction = '';
      if (daysOverdue <= 7) {
        toneInstruction = 'Use um TOM CORDIAL E EMPÁTICO. Sugira que pode ter sido um esquecimento. O foco é apenas o lembrete.';
      } else if (daysOverdue <= 30) {
        toneInstruction = 'Use um TOM PROFISSIONAL E OBJETIVO. Mencione a importância do serviço e ofereça opções de renegociação se aplicável.';
      } else {
        toneInstruction = 'Use um TOM FORMAL E FIRME. Mencione as consequências da suspensão do serviço e possíveis impactos no crédito.';
      }

      // Gerar link de pagamento
      const paymentLink = payment.payment_url || `https://vehicleguard-pro.lovable.app/checkout/${payment.id}`;

      // Preparar prompt estruturado para a IA
      const prompt = `**INSTRUÇÃO:** Crie uma mensagem de notificação de cobrança para WhatsApp. O texto deve ser focado, direto ao ponto e otimizado para a leitura no canal escolhido.

**DADOS DO CLIENTE E CONTEXTO:**
1. Nome do Cliente: ${client.name}
2. Valor Pendente: R$${payment.amount.toFixed(2)}
3. Dias de Atraso: ${daysOverdue} dias
4. Histórico de Pagamento: ${paymentHistory}
5. Link de Pagamento Direto: ${paymentLink}

**DEFINIÇÃO DO TOM DE VOZ:**
${toneInstruction}

**RESTRIÇÕES E REGRAS:**
* A mensagem deve ser iniciada com a saudação personalizada e a menção direta ao SaaS (${companyName}).
* **Proibido** usar a palavra "dívida". Use termos como "pendência", "pagamento pendente", "saldo em aberto" ou "fatura".
* Inclua o valor (R$${payment.amount.toFixed(2)}) e os dias de atraso (${daysOverdue} dias) no corpo da mensagem de forma clara.
* O call-to-action (CTA) principal deve ser o link de pagamento.
* Termine a mensagem com "Atenciosamente, ${companyName}".

**GERE APENAS O TEXTO DA MENSAGEM.**`;

      // Chamar OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.openai_model || 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: settings.system_prompt || 'Você é um assistente de comunicação de cobrança para um SaaS. Sua prioridade é a recuperação financeira mantendo um relacionamento cordial com o cliente.'
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 600,
          temperature: 0.7
        }),
      });

      const aiData = await response.json();
      
      if (!response.ok) {
        throw new Error(aiData.error?.message || 'Erro ao chamar OpenAI API');
      }

      const generatedMessage = aiData.choices[0].message.content;
      const usage = aiData.usage;

      // Buscar configurações do WhatsApp para enviar
      const { data: whatsappSettings } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('company_id', payment.company_id)
        .eq('is_active', true)
        .single();

      let messageSent = false;
      if (whatsappSettings) {
        console.log('Enviando mensagem via WhatsApp para:', client.phone);
        const whatsappResult = await supabase.functions.invoke('whatsapp-evolution', {
          body: {
            action: 'sendText',
            instance_url: whatsappSettings.instance_url,
            api_token: whatsappSettings.api_token,
            instance_name: whatsappSettings.instance_name,
            number: client.phone,
            message: generatedMessage,
            company_id: payment.company_id,
            client_id: client.id
          }
        });

        messageSent = whatsappResult.data?.success || false;
        console.log('Resultado do envio WhatsApp:', { messageSent, error: whatsappResult.error });
      } else {
        console.error('Configurações do WhatsApp não encontradas ou inativas');
      }

      // Salvar log da IA após enviar (se configurações existirem)
      if (aiSettings) {
        await supabase.from('ai_collection_logs').insert({
          company_id: payment.company_id,
          payment_id: payment.id,
          client_id: client.id,
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens,
          model_used: settings.openai_model || 'gpt-4o-mini',
          generated_message: generatedMessage,
          sent_successfully: messageSent
        });
      } else {
        console.log('Logs de IA não salvos - configurações não encontradas na tabela');
      }

      return new Response(
        JSON.stringify({ 
          success: messageSent,
          message: messageSent ? 'Cobrança enviada com sucesso' : 'Erro ao enviar mensagem',
          generated_message: generatedMessage,
          client_phone: client.phone,
          client_name: client.name
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

      // Buscar configurações de IA (usar padrão se não existir)
      const { data: aiSettings } = await supabase
        .from('ai_collection_settings')
        .select('*')
        .eq('company_id', company_id)
        .eq('is_active', true)
        .maybeSingle();

      // Usar configurações padrão se não estiverem configuradas
      const settings = aiSettings || {
        openai_model: 'gpt-4o-mini',
        system_prompt: 'Você é um assistente de comunicação de cobrança para um SaaS. Sua prioridade é a recuperação financeira mantendo um relacionamento cordial com o cliente.'
      };

      console.log('Process overdue - Usando configurações:', aiSettings ? 'personalizadas' : 'padrão');

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

        // Determinar histórico de pagamento
        const { data: pastPayments } = await supabase
          .from('payment_transactions')
          .select('status, due_date, paid_at')
          .eq('client_id', client.id)
          .eq('company_id', company_id)
          .neq('id', payment.id)
          .order('due_date', { ascending: false })
          .limit(5);

        let paymentHistory = 'Primeiro Atraso';
        if (pastPayments && pastPayments.length > 0) {
          const latePayments = pastPayments.filter(p => {
            if (p.paid_at && p.due_date) {
              return new Date(p.paid_at) > new Date(p.due_date);
            }
            return false;
          });
          paymentHistory = latePayments.length > 1 ? 'Atrasos Recorrentes' : 'Histórico Regular';
        }

        // Determinar tom baseado em dias de atraso
        let toneInstruction = '';
        if (daysOverdue <= 7) {
          toneInstruction = 'Use um TOM CORDIAL E EMPÁTICO. Sugira que pode ter sido um esquecimento. O foco é apenas o lembrete.';
        } else if (daysOverdue <= 30) {
          toneInstruction = 'Use um TOM PROFISSIONAL E OBJETIVO. Mencione a importância do serviço e ofereça opções de renegociação se aplicável.';
        } else {
          toneInstruction = 'Use um TOM FORMAL E FIRME. Mencione as consequências da suspensão do serviço e possíveis impactos no crédito.';
        }

        // Gerar link de pagamento
        const paymentLink = payment.payment_url || `https://vehicleguard-pro.lovable.app/checkout/${payment.id}`;

        try {
          // Preparar prompt estruturado para a IA
          const prompt = `**INSTRUÇÃO:** Crie uma mensagem de notificação de cobrança para WhatsApp. O texto deve ser focado, direto ao ponto e otimizado para a leitura no canal escolhido.

**DADOS DO CLIENTE E CONTEXTO:**
1. Nome do Cliente: ${client.name}
2. Valor Pendente: R$${payment.amount.toFixed(2)}
3. Dias de Atraso: ${daysOverdue} dias
4. Histórico de Pagamento: ${paymentHistory}
5. Link de Pagamento Direto: ${paymentLink}

**DEFINIÇÃO DO TOM DE VOZ:**
${toneInstruction}

**RESTRIÇÕES E REGRAS:**
* A mensagem deve ser iniciada com a saudação personalizada e a menção direta ao SaaS (${companyName}).
* **Proibido** usar a palavra "dívida". Use termos como "pendência", "pagamento pendente", "saldo em aberto" ou "fatura".
* Inclua o valor (R$${payment.amount.toFixed(2)}) e os dias de atraso (${daysOverdue} dias) no corpo da mensagem de forma clara.
* O call-to-action (CTA) principal deve ser o link de pagamento.
* Termine a mensagem com "Atenciosamente, ${companyName}".

**GERE APENAS O TEXTO DA MENSAGEM.**`;

          // Chamar OpenAI API
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
          body: JSON.stringify({
            model: settings.openai_model || 'gpt-4o-mini',
            messages: [
              { 
                role: 'system', 
                content: settings.system_prompt || 'Você é um assistente de comunicação de cobrança para um SaaS. Sua prioridade é a recuperação financeira mantendo um relacionamento cordial com o cliente.'
              },
              { role: 'user', content: prompt }
            ],
            max_tokens: 600,
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

          // Salvar log da IA após enviar (se configurações existirem)
          if (aiSettings) {
            await supabase.from('ai_collection_logs').insert({
              company_id,
              payment_id: payment.id,
              client_id: client.id,
              prompt_tokens: usage.prompt_tokens,
              completion_tokens: usage.completion_tokens,
              total_tokens: usage.total_tokens,
              model_used: settings.openai_model || 'gpt-4o-mini',
              generated_message: generatedMessage,
              sent_successfully: messageSent
            });
          }

          results.push({
            payment_id: payment.id,
            client_name: client.name,
            success: messageSent,
            message: generatedMessage
          });

        } catch (error) {
          console.error(`Erro ao processar pagamento ${payment.id}:`, error);
          
          // Salvar erro no log (se configurações existirem)
          if (aiSettings) {
            await supabase.from('ai_collection_logs').insert({
              company_id,
              payment_id: payment.id,
              client_id: client.id,
              model_used: settings.openai_model || 'gpt-4o-mini',
              sent_successfully: false,
              error_message: error instanceof Error ? error.message : String(error)
            });
          }

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

      // Buscar configurações de IA (usar padrão se não existir)
      const { data: aiSettings } = await supabase
        .from('ai_collection_settings')
        .select('*')
        .eq('company_id', company_id)
        .eq('is_active', true)
        .maybeSingle();

      // Usar configurações padrão se não estiverem configuradas
      const settings = aiSettings || {
        openai_model: 'gpt-4o-mini',
        system_prompt: 'Você é um assistente financeiro que gera relatórios executivos concisos.'
      };

      console.log('Relatório semanal - Usando configurações:', aiSettings ? 'personalizadas' : 'padrão');

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
          model: settings.openai_model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: settings.system_prompt },
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