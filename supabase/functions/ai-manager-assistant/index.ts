import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { nowInBrasilia, toISODateTimeBR } from "../_shared/timezone.ts";

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

  // Variáveis para garantir resposta
  let supabase: any;
  let manager_phone = '';
  let instance_url = '';
  let api_token = '';
  let instance_name = '';
  let company_id = '';
  
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    const requestData = await req.json();
    company_id = requestData.company_id;
    manager_phone = requestData.manager_phone;
    instance_url = requestData.instance_url;
    api_token = requestData.api_token;
    instance_name = requestData.instance_name;
    const message = requestData.message;
    
    console.log('Processando comando do gestor:', { company_id, message, manager_phone });

    // Buscar dados da empresa
    const { data: companyInfo } = await supabase
      .from('companies')
      .select('name')
      .eq('id', company_id)
      .single();

    const companyName = companyInfo?.name || 'sua empresa';

    // Buscar todos os clientes da empresa
    const { data: allClients } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', company_id)
      .order('name', { ascending: true });

    // Buscar pagamentos em aberto
    const { data: overduePayments } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        clients:client_id(id, name, phone, email, document, address, status)
      `)
      .eq('company_id', company_id)
      .eq('status', 'overdue')
      .order('due_date', { ascending: true })
      .limit(50);

    // Buscar pagamentos pendentes
    const { data: pendingPayments } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        clients:client_id(id, name, phone, email, document, address, status)
      `)
      .eq('company_id', company_id)
      .eq('status', 'pending')
      .order('due_date', { ascending: true })
      .limit(50);

    // Buscar últimos pagamentos recebidos (com nome do cliente)
    const { data: paidPayments } = await supabase
      .from('payment_transactions')
      .select('amount, paid_at, clients:client_id(name)')
      .eq('company_id', company_id)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(30);

    // Filtrar pagamentos de HOJE
    const today = new Date().toISOString().split('T')[0];
    const todayPayments = paidPayments?.filter(p => p.paid_at?.startsWith(today)) || [];

    // Construir contexto financeiro
    const totalOverdue = overduePayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const totalPending = pendingPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const totalPaid = paidPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    const overdueDetails = overduePayments?.map(p => ({
      client: p.clients?.name || 'Cliente não identificado',
      client_phone: p.clients?.phone,
      client_email: p.clients?.email,
      client_document: p.clients?.document,
      client_address: p.clients?.address,
      amount: Number(p.amount),
      due_date: p.due_date,
      days_overdue: Math.floor((new Date().getTime() - new Date(p.due_date).getTime()) / (1000 * 60 * 60 * 24)),
      id: p.id
    })) || [];

    const pendingDetails = pendingPayments?.map(p => ({
      client: p.clients?.name || 'Cliente não identificado',
      client_phone: p.clients?.phone,
      client_email: p.clients?.email,
      client_document: p.clients?.document,
      client_address: p.clients?.address,
      amount: Number(p.amount),
      due_date: p.due_date,
      days_until_due: Math.ceil((new Date(p.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
      id: p.id
    })) || [];

    // Informações dos clientes
    const clientsInfo = allClients?.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      document: c.document,
      address: c.address,
      status: c.status
    })) || [];

    // Data/hora atual no fuso horário do Brasil
    const currentDateTime = toISODateTimeBR(nowInBrasilia());

    // Preparar prompt para a IA
    const systemPrompt = `Você é um assistente de gestão financeira inteligente para ${companyName}.

DATA E HORA ATUAL NO BRASIL: ${currentDateTime} (Horário de Brasília - UTC-3)
Use SEMPRE esta data/hora como referência para interpretar comandos como "amanhã", "hoje", "daqui a 2 dias", etc.

Suas capacidades:
1. Fornecer informações completas sobre clientes, cobranças, pagamentos e situação financeira
2. Acessar dados cadastrais de todos os clientes (nome, telefone, email, documento, endereço)
3. Executar ações quando solicitado pelo gestor:
   - Forçar cobrança de clientes inadimplentes (enviar mensagem de cobrança via IA)
   - Gerar relatórios financeiros
   - Listar clientes com pagamentos em atraso
   - Fornecer informações detalhadas sobre qualquer cliente
   - **AGENDAR LEMBRETES**: Criar lembretes para horários específicos
   - **AGENDAR COBRANÇAS**: Programar cobranças automáticas para datas/horários específicos

Contexto financeiro atual:
- Total em atraso: R$ ${totalOverdue.toFixed(2)} (${overduePayments?.length || 0} cobranças)
- Total pendente: R$ ${totalPending.toFixed(2)} (${pendingPayments?.length || 0} cobranças)
- Total recebido (últimos 30): R$ ${totalPaid.toFixed(2)}
- Total de clientes cadastrados: ${allClients?.length || 0}

PAGAMENTOS RECEBIDOS HOJE (${today}):
${todayPayments.length > 0 
  ? todayPayments.map((p: any) => `- ${p.clients?.name || 'Cliente'}: R$ ${Number(p.amount).toFixed(2)} (pago às ${p.paid_at?.split('T')[1]?.substring(0,5) || ''})`).join('\n')
  : 'Nenhum pagamento recebido hoje ainda'}

Clientes cadastrados (completo):
${clientsInfo.map((c, i) => `${i + 1}. ${c.name}
   - Telefone: ${c.phone || 'Não informado'}
   - Email: ${c.email || 'Não informado'}
   - Documento: ${c.document || 'Não informado'}
   - Endereço: ${c.address || 'Não informado'}
   - Status: ${c.status}
   - ID: ${c.id}`).join('\n') || 'Nenhum cliente cadastrado'}

Cobranças em atraso (detalhado):
${overdueDetails.map((p, i) => `${i + 1}. ${p.client}
   - Telefone: ${p.client_phone || 'Não informado'}
   - Email: ${p.client_email || 'Não informado'}
   - Documento: ${p.client_document || 'Não informado'}
   - Endereço: ${p.client_address || 'Não informado'}
   - Valor: R$ ${p.amount.toFixed(2)}
   - Vencimento: ${p.due_date}
   - Dias em atraso: ${p.days_overdue}
   - ID do pagamento: ${p.id}`).join('\n\n') || 'Nenhuma cobrança em atraso'}

Cobranças pendentes (não vencidas ainda):
${pendingDetails.map((p, i) => `${i + 1}. ${p.client}
   - Telefone: ${p.client_phone || 'Não informado'}
   - Email: ${p.client_email || 'Não informado'}
   - Documento: ${p.client_document || 'Não informado'}
   - Endereço: ${p.client_address || 'Não informado'}
   - Valor: R$ ${p.amount.toFixed(2)}
   - Vencimento: ${p.due_date}
   - Dias até vencer: ${p.days_until_due}
   - ID do pagamento: ${p.id}`).join('\n\n') || 'Nenhuma cobrança pendente'}

REGRAS IMPORTANTES:
- NUNCA use LaTeX, fórmulas matemáticas ou código de programação nas respostas
- Seja direto, objetivo e profissional
- Use apenas texto simples e números formatados como "R$ 100,00" ou "50%"
- Para cálculos, apresente apenas o RESULTADO final de forma clara
- Exemplo CORRETO: "A taxa de inadimplência é 50% (20 em atraso de 40 clientes total)"
- Exemplo ERRADO: "\\frac{20}{40} \\times 100 = 50%"
- VOCÊ PRECISA SEMPRE RESPONDER, NUNCA FIQUE SILENCIOSO

COMANDOS ESPECIAIS:
- Para forçar cobrança IMEDIATA: Use "EXECUTAR_COBRANCA:" seguido do ID REAL do pagamento
  * ATENÇÃO: SEMPRE use o ID REAL do pagamento listado acima, NUNCA use "ID_DO_PAGAMENTO" como placeholder
  * Exemplo correto: "EXECUTAR_COBRANCA:a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  * Quando o gestor pedir "dispare a notificação dessa cobrança pendente", identifique qual cobrança (geralmente a mais recente ou única pendente) e use seu ID real
- Para gerar relatório: "EXECUTAR_RELATORIO"
- Para agendar lembrete: "AGENDAR_LEMBRETE:YYYY-MM-DD HH:MM:MENSAGEM" (exemplo: "AGENDAR_LEMBRETE:2025-10-09 09:00:Atualizar base de dados")
- Para agendar cobrança: "AGENDAR_COBRANCA:YYYY-MM-DD HH:MM:ID_REAL_DO_PAGAMENTO" - use sempre o ID real do pagamento, não o placeholder
- Para outras perguntas, responda normalmente com TODAS as informações disponíveis em linguagem natural

IMPORTANTE SOBRE DATAS:
- A data/hora atual no Brasil é: ${currentDateTime}
- Ao interpretar "amanhã", adicione 1 dia à data atual
- Ao interpretar "hoje", use a data atual
- SEMPRE use o horário de Brasília (UTC-3) nas datas agendadas
- Quando o gestor solicitar lembretes ou cobranças futuras, SEMPRE use os comandos de agendamento acima`;

    // Detectar se é um pedido de lembrete para não oferecer web_search
    const isReminderRequest = /\b(lembra|lembre|avisa|alerta|notifica|agenda)\b/i.test(message);
    
    const userPrompt = `Mensagem do gestor: "${message}"

Analise a solicitação e responda adequadamente:

1. Se for um pedido de LEMBRETE (ex: "me lembra", "lembre-me", "agendar lembrete"), use o comando AGENDAR_LEMBRETE no formato:
   AGENDAR_LEMBRETE:YYYY-MM-DD HH:MM:MENSAGEM
   Exemplo: AGENDAR_LEMBRETE:2025-10-09 14:10:Atualizar a base

2. Se for solicitação para DISPARAR/FORÇAR COBRANÇA IMEDIATA:
   - Identifique qual cobrança o gestor está se referindo (pendente, em atraso, cliente específico, etc.)
   - Use o ID REAL do pagamento listado no contexto acima
   - NUNCA use placeholders como "ID_DO_PAGAMENTO"
   - Formato: EXECUTAR_COBRANCA:a1b2c3d4-e5f6-7890-abcd-ef1234567890
   - Exemplo: Se há uma cobrança pendente com ID "550e8400-e29b-41d4-a716-446655440000", use: EXECUTAR_COBRANCA:550e8400-e29b-41d4-a716-446655440000

3. Se for uma solicitação de gerar relatório, use: EXECUTAR_RELATORIO

4. Se for pergunta sobre clientes, pagamentos ou finanças da empresa, responda com os dados fornecidos

CRÍTICO: Quando usar comandos como EXECUTAR_COBRANCA ou AGENDAR_COBRANCA, SEMPRE extraia e use o ID REAL do pagamento do contexto fornecido. NUNCA deixe "ID_DO_PAGAMENTO" como placeholder.

Importante: Para lembretes, SEMPRE use o horário de Brasília e a data/hora atual é: ${currentDateTime}`;

    // Chamar OpenAI API com function calling
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    let aiResponse = '';
    let shouldContinue = true;
    let iterationCount = 0;
    const maxIterations = 3;

    // Tentar chamar a IA com tratamento de erro robusto
    try {
      while (shouldContinue && iterationCount < maxIterations) {
        iterationCount++;
        
        const requestBody: any = {
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 1000,
          temperature: 0.3,
        };

        // Só incluir web_search se NÃO for pedido de lembrete
        if (!isReminderRequest) {
          requestBody.tools = [
            {
              type: 'function',
              function: {
                name: 'web_search',
                description: 'Busca informações na internet quando a resposta não está nos dados da empresa. Use apenas para informações gerais, notícias, dados públicos.',
                parameters: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'Consulta de busca em português ou inglês'
                    }
                  },
                  required: ['query']
                }
              }
            }
          ];
          requestBody.tool_choice = 'auto';
        }
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const aiData = await response.json();
        
        if (!response.ok) {
          console.error('Erro na chamada OpenAI:', aiData);
          throw new Error(aiData.error?.message || 'Erro ao chamar OpenAI API');
        }

        const choice = aiData.choices[0];
        
        // Se o modelo quer usar uma ferramenta
        if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
          console.log('GPT solicitou busca na web');
          messages.push(choice.message);
          
          for (const toolCall of choice.message.tool_calls) {
            if (toolCall.function.name === 'web_search') {
              const args = JSON.parse(toolCall.function.arguments);
              console.log('Buscando na web:', args.query);
              
              try {
                // Buscar usando DuckDuckGo
                const searchQuery = encodeURIComponent(args.query);
                const searchResponse = await fetch(
                  `https://api.duckduckgo.com/?q=${searchQuery}&format=json&no_html=1&skip_disambig=1`
                );
                
                const searchData = await searchResponse.json();
                
                // Extrair resultados relevantes
                let searchResults = '';
                
                if (searchData.AbstractText) {
                  searchResults += `Resumo: ${searchData.AbstractText}\n\n`;
                }
                
                if (searchData.RelatedTopics && searchData.RelatedTopics.length > 0) {
                  searchResults += 'Informações encontradas:\n';
                  searchData.RelatedTopics.slice(0, 5).forEach((topic: any, idx: number) => {
                    if (topic.Text) {
                      searchResults += `${idx + 1}. ${topic.Text}\n`;
                    }
                  });
                }
                
                if (!searchResults) {
                  searchResults = 'Não foram encontrados resultados específicos. Tente reformular a pergunta ou buscar informações mais específicas da empresa.';
                }
                
                // Adicionar resultado da busca às mensagens
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: searchResults
                });
                
                console.log('Resultados da busca:', searchResults.substring(0, 200));
              } catch (searchError) {
                console.error('Erro na busca web:', searchError);
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: 'Desculpe, não foi possível buscar informações na internet no momento. Posso ajudar com informações sobre os clientes e pagamentos da empresa.'
                });
              }
            }
          }
        } else {
          // Resposta final do modelo
          aiResponse = choice.message.content;
          shouldContinue = false;
        }
      }
    } catch (aiError) {
      console.error('Erro crítico ao chamar IA:', aiError);
      // Fallback em caso de erro na IA
      aiResponse = 'Desculpe, estou com dificuldades técnicas no momento. Por favor, tente novamente em alguns instantes ou reformule sua pergunta de forma mais simples.';
    }
    
    console.log('Resposta da IA:', aiResponse);

    // Processar comandos
    let finalResponse = aiResponse;
    
    // Garantir que sempre há uma resposta
    if (!finalResponse || finalResponse.trim() === '') {
      finalResponse = 'Olá! Estou aqui para ajudar. Como posso auxiliá-lo com as cobranças e gestão dos clientes?';
      console.log('Resposta vazia detectada, usando fallback');
    }
    
    // Detectar comando de cobrança
    const forceCollectionMatch = aiResponse.match(/EXECUTAR_COBRANCA:([a-f0-9-]+)/);
    if (forceCollectionMatch) {
      const paymentId = forceCollectionMatch[1];
      console.log('Executando cobrança para pagamento:', paymentId);
      
      // Invocar função de cobrança individual (apenas gera a mensagem)
      const collectionResult = await supabase.functions.invoke('ai-collection', {
        body: {
          action: 'process_specific_payment',
          company_id,
          payment_id: paymentId
        }
      });
      
      console.log('Resultado da cobrança:', collectionResult);
      
      // Verificar se houve erro ou sucesso
      if (collectionResult.error || !collectionResult.data?.success) {
        const errorMsg = collectionResult.error?.message || collectionResult.data?.error || 'Erro desconhecido';
        console.error('Erro ao executar cobrança:', errorMsg);
        finalResponse = aiResponse.replace(/EXECUTAR_COBRANCA:[a-f0-9-]+/, `❌ Erro ao enviar cobrança: ${errorMsg}`);
      } else {
        // AGORA PRECISAMOS ENVIAR A MENSAGEM VIA WHATSAPP
        const generatedMessage = collectionResult.data.generated_message;
        const clientPhone = collectionResult.data.client_phone;
        const clientName = collectionResult.data.client_name;
        
        console.log('Mensagem gerada, enviando para cliente:', clientName, clientPhone);
        
        // Buscar configurações do WhatsApp
        const { data: whatsappSettings } = await supabase
          .from('whatsapp_settings')
          .select('*')
          .eq('company_id', company_id)
          .eq('is_active', true)
          .single();
        
        if (whatsappSettings && clientPhone) {
          // Buscar informações da empresa para o link
          const { data: companyInfo } = await supabase
            .from('companies')
            .select('domain')
            .eq('id', company_id)
            .single();
          
          const defaultAppUrl = Deno.env.get('APP_URL') || 'https://vehicleguard-pro.lovable.app';
          const baseUrl = companyInfo?.domain 
            ? `https://${companyInfo.domain.replace(/^https?:\/\//, '')}` 
            : defaultAppUrl;
          const paymentLink = `${baseUrl}/checkout/${paymentId}`;
          
          // Construir mensagem completa com link
          const fullMessage = `${generatedMessage}\n\n🔗 Acesse aqui: ${paymentLink}`;
          
          // Enviar via WhatsApp
          const sendResult = await supabase.functions.invoke('whatsapp-evolution', {
            body: {
              action: 'sendText',
              instance_url: whatsappSettings.instance_url,
              api_token: whatsappSettings.api_token,
              instance_name: whatsappSettings.instance_name,
              number: clientPhone,
              message: fullMessage,
              company_id,
              linkPreview: false
            }
          });
          
          console.log('Resultado do envio WhatsApp:', sendResult);
          
          if (sendResult.data?.success) {
            finalResponse = aiResponse.replace(/EXECUTAR_COBRANCA:[a-f0-9-]+/, `✅ Cobrança enviada com sucesso para ${clientName}!`);
          } else {
            finalResponse = aiResponse.replace(/EXECUTAR_COBRANCA:[a-f0-9-]+/, `⚠️ Mensagem gerada mas erro ao enviar: ${sendResult.error?.message || 'Falha no envio'}`);
          }
        } else {
          console.error('WhatsApp não configurado ou cliente sem telefone');
          finalResponse = aiResponse.replace(/EXECUTAR_COBRANCA:[a-f0-9-]+/, '⚠️ Mensagem gerada mas WhatsApp não configurado ou cliente sem telefone');
        }
      }
    }

    // Detectar comando de relatório
    if (aiResponse.includes('EXECUTAR_RELATORIO')) {
      console.log('Gerando relatório financeiro');
      
      try {
        const reportResult = await supabase.functions.invoke('ai-collection', {
          body: {
            action: 'generate_weekly_report',
            company_id
          }
        });
        
        finalResponse = aiResponse.replace('EXECUTAR_RELATORIO', '✅ Relatório gerado acima!');
      } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        finalResponse = aiResponse.replace('EXECUTAR_RELATORIO', '❌ Erro ao gerar relatório.');
      }
    }

    // Detectar comando de agendar lembrete
    const reminderMatch = aiResponse.match(/AGENDAR_LEMBRETE:(\d{4}-\d{2}-\d{2} \d{2}:\d{2}):(.+)/);
    if (reminderMatch) {
      const [, scheduledTime, reminderText] = reminderMatch;
      console.log('Agendando lembrete:', { scheduledTime, reminderText });
      
      try {
        // Converter horário de Brasília para UTC para armazenar no banco
        const brasiliaDateStr = scheduledTime + ':00-03:00';
        const brasiliaDate = new Date(brasiliaDateStr);
        
        await supabase
          .from('scheduled_reminders')
          .insert({
            company_id,
            manager_phone,
            reminder_text: reminderText.trim(),
            scheduled_for: brasiliaDate.toISOString(),
            action_type: 'reminder'
          });
        
        finalResponse = aiResponse.replace(/AGENDAR_LEMBRETE:[^\n]+/, `✅ Lembrete agendado para ${scheduledTime} (Horário de Brasília)!`);
      } catch (error) {
        console.error('Erro ao agendar lembrete:', error);
        finalResponse = aiResponse.replace(/AGENDAR_LEMBRETE:[^\n]+/, '❌ Erro ao agendar lembrete.');
      }
    }

    // Detectar comando de agendar cobrança
    const scheduleCollectionMatch = aiResponse.match(/AGENDAR_COBRANCA:(\d{4}-\d{2}-\d{2} \d{2}:\d{2}):([a-f0-9-]+)/);
    if (scheduleCollectionMatch) {
      const [, scheduledTime, paymentId] = scheduleCollectionMatch;
      console.log('Agendando cobrança:', { scheduledTime, paymentId });
      
      try {
        // Converter horário de Brasília para UTC para armazenar no banco
        const brasiliaDateStr = scheduledTime + ':00-03:00';
        const brasiliaDate = new Date(brasiliaDateStr);
        
        await supabase
          .from('scheduled_reminders')
          .insert({
            company_id,
            manager_phone,
            reminder_text: `Cobrança automática agendada`,
            scheduled_for: brasiliaDate.toISOString(),
            action_type: 'collection',
            metadata: { payment_id: paymentId }
          });
        
        finalResponse = aiResponse.replace(/AGENDAR_COBRANCA:[^\n]+/, `✅ Cobrança agendada para ${scheduledTime} (Horário de Brasília)!`);
      } catch (error) {
        console.error('Erro ao agendar cobrança:', error);
        finalResponse = aiResponse.replace(/AGENDAR_COBRANCA:[^\n]+/, '❌ Erro ao agendar cobrança.');
      }
    }

    // Enviar resposta via WhatsApp
    await supabase.functions.invoke('whatsapp-evolution', {
      body: {
        action: 'sendText',
        instance_url,
        api_token,
        instance_name,
        number: manager_phone,
        message: finalResponse,
        company_id
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        response: finalResponse
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro crítico no assistente do gestor:', error);
    
    // SEMPRE tentar enviar uma mensagem de erro ao gestor
    const errorMessage = '❌ Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente em alguns instantes.';
    
    try {
      // Tentar enviar mensagem de erro via WhatsApp se temos as credenciais
      if (supabase && manager_phone && instance_url && api_token && instance_name) {
        console.log('Enviando mensagem de erro ao gestor via WhatsApp');
        await supabase.functions.invoke('whatsapp-evolution', {
          body: {
            action: 'sendText',
            instance_url,
            api_token,
            instance_name,
            number: manager_phone,
            message: errorMessage,
            company_id
          }
        });
      }
    } catch (whatsappError) {
      console.error('Erro ao enviar mensagem de erro via WhatsApp:', whatsappError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        message: 'Erro processado e usuário notificado'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
