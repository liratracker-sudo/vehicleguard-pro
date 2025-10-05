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
    const { company_id, message, manager_phone, instance_url, api_token, instance_name } = await req.json();
    
    console.log('Processando comando do gestor:', { company_id, message, manager_phone });

    // Buscar dados da empresa
    const { data: companyInfo } = await supabase
      .from('companies')
      .select('name')
      .eq('id', company_id)
      .single();

    const companyName = companyInfo?.name || 'sua empresa';

    // Buscar pagamentos em aberto
    const { data: overduePayments } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        clients:client_id(name, phone)
      `)
      .eq('company_id', company_id)
      .eq('status', 'overdue')
      .order('due_date', { ascending: true })
      .limit(20);

    // Buscar pagamentos pendentes
    const { data: pendingPayments } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        clients:client_id(name, phone)
      `)
      .eq('company_id', company_id)
      .eq('status', 'pending')
      .order('due_date', { ascending: true })
      .limit(20);

    // Buscar últimos pagamentos recebidos
    const { data: paidPayments } = await supabase
      .from('payment_transactions')
      .select('amount, paid_at')
      .eq('company_id', company_id)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(10);

    // Construir contexto financeiro
    const totalOverdue = overduePayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const totalPending = pendingPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const totalPaid = paidPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    const overdueDetails = overduePayments?.map(p => ({
      client: p.clients?.name || 'Cliente não identificado',
      amount: Number(p.amount),
      due_date: p.due_date,
      days_overdue: Math.floor((new Date().getTime() - new Date(p.due_date).getTime()) / (1000 * 60 * 60 * 24)),
      id: p.id
    })) || [];

    // Preparar prompt para a IA
    const systemPrompt = `Você é um assistente de gestão financeira inteligente para ${companyName}.

Suas capacidades:
1. Fornecer informações sobre cobranças, pagamentos e situação financeira
2. Executar ações quando solicitado pelo gestor:
   - Forçar cobrança de clientes inadimplentes (enviar mensagem de cobrança via IA)
   - Gerar relatórios financeiros
   - Listar clientes com pagamentos em atraso

Contexto financeiro atual:
- Total em atraso: R$ ${totalOverdue.toFixed(2)} (${overduePayments?.length || 0} cobranças)
- Total pendente: R$ ${totalPending.toFixed(2)} (${pendingPayments?.length || 0} cobranças)
- Total recebido (últimos 10): R$ ${totalPaid.toFixed(2)}

Cobranças em atraso:
${overdueDetails.map((p, i) => `${i + 1}. ${p.client} - R$ ${p.amount.toFixed(2)} - ${p.days_overdue} dias de atraso - ID: ${p.id}`).join('\n') || 'Nenhuma cobrança em atraso'}

IMPORTANTE: 
- Seja direto e profissional
- Quando o gestor pedir para "forçar cobrança", identifique o pagamento específico e responda com a instrução exata: "EXECUTAR_COBRANCA:ID_DO_PAGAMENTO"
- Para relatórios, responda "EXECUTAR_RELATORIO"
- Para outras perguntas, responda normalmente com as informações disponíveis`;

    const userPrompt = `Mensagem do gestor: "${message}"

Analise a solicitação e responda adequadamente. Se for uma solicitação de ação (forçar cobrança, gerar relatório), inclua o comando apropriado no início da resposta.`;

    // Chamar OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.3
      }),
    });

    const aiData = await response.json();
    
    if (!response.ok) {
      throw new Error(aiData.error?.message || 'Erro ao chamar OpenAI API');
    }

    const aiResponse = aiData.choices[0].message.content;
    console.log('Resposta da IA:', aiResponse);

    // Processar comandos
    let finalResponse = aiResponse;
    
    // Detectar comando de cobrança
    const forceCollectionMatch = aiResponse.match(/EXECUTAR_COBRANCA:([a-f0-9-]+)/);
    if (forceCollectionMatch) {
      const paymentId = forceCollectionMatch[1];
      console.log('Executando cobrança para pagamento:', paymentId);
      
      try {
        // Invocar função de cobrança individual
        await supabase.functions.invoke('ai-collection', {
          body: {
            action: 'process_specific_payment',
            company_id,
            payment_id: paymentId
          }
        });
        
        finalResponse = aiResponse.replace(/EXECUTAR_COBRANCA:[a-f0-9-]+/, '✅ Cobrança enviada com sucesso!');
      } catch (error) {
        console.error('Erro ao executar cobrança:', error);
        finalResponse = aiResponse.replace(/EXECUTAR_COBRANCA:[a-f0-9-]+/, '❌ Erro ao enviar cobrança.');
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
    console.error('Erro no assistente do gestor:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
