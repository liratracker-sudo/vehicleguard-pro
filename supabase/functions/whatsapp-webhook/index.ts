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
      
      // Para grupos, usar participant; para chats individuais, usar remoteJid
      let phoneNumber = '';
      if (isGroup) {
        // Em grupos, o remetente está em participantAlt ou participant
        const participant = message.key?.participantAlt || message.key?.participant || '';
        phoneNumber = participant
          .replace('@s.whatsapp.net', '')
          .replace('@lid', '')
          .replace(/:\d+/, ''); // Remove sufixos como :58
      } else {
        phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
      }
      
      const messageText = message.message?.conversation || 
                         message.message?.extendedTextMessage?.text || '';

      console.log('Mensagem recebida:', { instanceName, phoneNumber, messageText, isGroup, remoteJid });

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

      // Buscar informações do cliente (se existir)
      let clientInfo = '';
      let paymentInfo = '';
      
      if (client) {
        clientInfo = `Nome: ${client.name}\n`;
        
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
          
          paymentInfo = `\nÚltima Cobrança:\n`;
          paymentInfo += `- Valor: R$ ${parseFloat(lastPayment.amount).toFixed(2)}\n`;
          paymentInfo += `- Vencimento: ${new Date(lastPayment.due_date).toLocaleDateString('pt-BR')}\n`;
          paymentInfo += `- Status: ${statusMap[lastPayment.status] || lastPayment.status}\n`;
          
          if (lastPayment.status === 'overdue') {
            const diasAtraso = Math.floor((Date.now() - new Date(lastPayment.due_date).getTime()) / (1000 * 60 * 60 * 24));
            paymentInfo += `- Dias em atraso: ${diasAtraso}\n`;
          }
        }
      } else {
        clientInfo = 'Cliente não cadastrado no sistema\n';
      }

      // Montar prompt para a IA
      const prompt = `${aiSettings.system_prompt}

INFORMAÇÕES DO CLIENTE:
${clientInfo}${paymentInfo}

MENSAGEM DO CLIENTE:
"${messageText}"

INSTRUÇÕES:
- Responda de forma profissional e amigável
- Se o cliente perguntar sobre fatura/boleto/pagamento e houver cobrança pendente/vencida, informe os detalhes
- Se não houver informações de pagamento, informe que não há cobranças pendentes
- Se o cliente não estiver cadastrado, oriente-o a entrar em contato com a empresa
- Mantenha a resposta concisa (máximo 3 parágrafos)
- Use emojis quando apropriado para tornar a mensagem mais amigável

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
          payload: {
            instance_url: settings.instance_url,
            api_token: settings.api_token,
            instance_name: instanceName,
            phone: phoneNumber,
            message: aiMessage,
            company_id: settings.company_id,
            client_id: client?.id || null
          }
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
