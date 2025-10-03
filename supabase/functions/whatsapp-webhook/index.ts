import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const webhookData = await req.json();
    console.log('Webhook recebido:', JSON.stringify(webhookData, null, 2));

    // Verifica se é uma mensagem recebida
    if (webhookData.event === 'messages.upsert') {
      const message = webhookData.data;
      
      if (!message || message.key?.fromMe) {
        return new Response(JSON.stringify({ success: true, message: 'Mensagem ignorada (enviada por nós)' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const instanceName = webhookData.instance;
      const remoteJid = message.key?.remoteJid || '';
      const isGroup = remoteJid.includes('@g.us');
      
      // Ignorar mensagens de grupos
      if (isGroup) {
        console.log('Mensagem de grupo ignorada:', remoteJid);
        return new Response(JSON.stringify({ success: true, message: 'Mensagens de grupo são ignoradas' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
      
      const messageText = message.message?.conversation || 
                         message.message?.extendedTextMessage?.text || '';

      console.log('Mensagem recebida:', { instanceName, phoneNumber, messageText });

      // Buscar configurações do WhatsApp e company_id
      const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('company_id, instance_url, api_token')
        .eq('instance_name', instanceName)
        .eq('is_active', true)
        .single();

      if (!settings) {
        console.log('Configuração não encontrada para instância:', instanceName);
        return new Response(JSON.stringify({ success: false, error: 'Configuração não encontrada' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Buscar cliente pelo telefone
      const { data: client } = await supabase
        .from('clients')
        .select('id, name')
        .eq('company_id', settings.company_id)
        .eq('phone', phoneNumber)
        .single();

      // Registrar log da mensagem recebida
      await supabase.from('whatsapp_logs').insert({
        company_id: settings.company_id,
        client_id: client?.id || null,
        phone_number: phoneNumber,
        message_type: 'received',
        message_content: messageText,
        status: 'received',
      });

      // Se não houver texto na mensagem, ignorar
      if (!messageText || messageText.trim() === '') {
        console.log('Mensagem sem texto, ignorando');
        return new Response(JSON.stringify({ success: true, message: 'Mensagem sem texto' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Buscar configurações de IA da empresa
      const { data: aiSettings } = await supabase
        .from('ai_collection_settings')
        .select('*')
        .eq('company_id', settings.company_id)
        .eq('is_active', true)
        .single();

      if (!aiSettings) {
        console.log('Configurações de IA não encontradas ou inativas');
        return new Response(JSON.stringify({ success: true, message: 'IA não configurada' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Detectar se é pedido relacionado a fatura/boleto/pagamento
      const isFaturaRequest = /\b(fatura|boleto|pagamento|pagar|vencimento|cobrança|cobranca|debito|débito|conta|devo|pix|barra)\b/i.test(messageText);
      
      // Buscar informações do cliente (se existir)
      let clientInfo = '';
      let paymentInfo = '';
      let contextualInstructions = '';
      
      if (client) {
        clientInfo = `CLIENTE CADASTRADO:\nNome: ${client.name}\n`;
        
        // Buscar último pagamento
        const { data: lastPayment } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('company_id', settings.company_id)
          .eq('client_id', client.id)
          .order('due_date', { ascending: false })
          .limit(1)
          .single();

        if (lastPayment) {
          const statusMap: Record<string, string> = {
            'pending': 'Pendente',
            'overdue': 'Vencida',
            'paid': 'Paga',
            'cancelled': 'Cancelada'
          };
          
          paymentInfo = `\nINFORMAÇÕES DE PAGAMENTO:\n`;
          paymentInfo += `- Valor: R$ ${parseFloat(lastPayment.amount).toFixed(2)}\n`;
          paymentInfo += `- Vencimento: ${new Date(lastPayment.due_date).toLocaleDateString('pt-BR')}\n`;
          paymentInfo += `- Status: ${statusMap[lastPayment.status] || lastPayment.status}\n`;
          
          if (lastPayment.payment_url) {
            paymentInfo += `- Link de pagamento: ${lastPayment.payment_url}\n`;
          }
          
          if (lastPayment.status === 'overdue') {
            const diasAtraso = Math.floor((Date.now() - new Date(lastPayment.due_date).getTime()) / (1000 * 60 * 60 * 24));
            paymentInfo += `- Dias em atraso: ${diasAtraso}\n`;
          }
        }
        
        contextualInstructions = `
INSTRUÇÕES PARA CLIENTE CADASTRADO:
- Se perguntarem sobre fatura/pagamento e houver cobrança, forneça os detalhes acima
- Se não houver cobrança pendente, informe que está tudo em dia
- Seja útil e responda outras dúvidas que o cliente possa ter
- Use um tom amigável e profissional`;
      } else {
        clientInfo = `CONTATO NÃO CADASTRADO:\nEste número não está cadastrado no sistema.\n`;
        
        if (isFaturaRequest) {
          contextualInstructions = `
INSTRUÇÕES PARA CONSULTA DE FATURA (NÃO CADASTRADO):
- Informe que para consultar a fatura, precisamos do CPF
- Peça educadamente: "Para consultar sua fatura, por favor, me informe seu CPF."
- Explique que com o CPF poderemos localizar o cadastro e fornecer as informações`;
        } else {
          contextualInstructions = `
INSTRUÇÕES PARA ATENDIMENTO GERAL (NÃO CADASTRADO):
- Cumprimente de forma amigável
- Pergunte como pode ajudar
- Responda dúvidas sobre serviços, planos, rastreamento veicular
- Se necessário, oriente a entrar em contato para cadastro
- Seja prestativo e tire as dúvidas do cliente`;
        }
      }

      // Montar prompt para a IA
      const prompt = `${aiSettings.system_prompt}

${clientInfo}${paymentInfo}

MENSAGEM DO CLIENTE:
"${messageText}"

${contextualInstructions}

IMPORTANTE:
- Mantenha respostas concisas (máximo 3 parágrafos)
- Use emojis com moderação para tornar a conversa mais amigável
- Sempre finalize se colocando à disposição para mais dúvidas

RESPOSTA:`;

      console.log('Gerando resposta com IA...');

      // Chamar OpenAI
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: aiSettings.openai_model || 'gpt-4o-mini',
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('Erro na API OpenAI:', errorText);
        throw new Error(`OpenAI API error: ${openaiResponse.status}`);
      }

      const aiData = await openaiResponse.json();
      const aiMessage = aiData.choices[0].message.content;

      console.log('Resposta da IA gerada:', aiMessage);

      // Enviar resposta via WhatsApp
      const { error: sendError } = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'sendText',
          instance_url: settings.instance_url,
          api_token: settings.api_token,
          instance_name: instanceName,
          phone_number: phoneNumber,
          message: aiMessage,
          company_id: settings.company_id,
          client_id: client?.id || null
        }
      });

      if (sendError) {
        console.error('Erro ao enviar mensagem:', sendError);
      } else {
        console.log('Mensagem enviada com sucesso');
        
        // Registrar interação da IA
        await supabase.from('ai_collection_logs').insert({
          company_id: settings.company_id,
          client_id: client?.id || null,
          payment_id: null,
          prompt: prompt,
          response: aiMessage,
          model: aiSettings.openai_model || 'gpt-4o-mini',
          status: 'success'
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
