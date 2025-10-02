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
      const message = webhookData.data?.messages?.[0];
      
      if (!message || message.key?.fromMe) {
        return new Response(JSON.stringify({ success: true, message: 'Mensagem ignorada (enviada por nós)' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const instanceName = webhookData.instance;
      const phoneNumber = message.key?.remoteJid?.replace('@s.whatsapp.net', '');
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

      // Verificar se o cliente pediu fatura
      const mensagemLower = messageText.toLowerCase();
      const pedeFatura = mensagemLower.includes('fatura') || 
                        mensagemLower.includes('boleto') || 
                        mensagemLower.includes('cobrança') ||
                        mensagemLower.includes('cobranca') ||
                        mensagemLower.includes('pagamento');

      if (pedeFatura && client) {
        console.log('Cliente pediu fatura:', client.name);

        // Buscar pagamento pendente ou vencido mais recente do cliente
        const { data: payment } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('company_id', settings.company_id)
          .eq('client_id', client.id)
          .in('status', ['pending', 'overdue'])
          .order('due_date', { ascending: true })
          .limit(1)
          .single();

        if (payment) {
          const valor = parseFloat(payment.amount).toFixed(2).replace('.', ',');
          const vencimento = new Date(payment.due_date).toLocaleDateString('pt-BR');
          
          let respostaFatura = `Olá ${client.name}! 📄\n\n`;
          respostaFatura += `Aqui está sua fatura:\n`;
          respostaFatura += `💰 Valor: R$ ${valor}\n`;
          respostaFatura += `📅 Vencimento: ${vencimento}\n\n`;

          if (payment.payment_url) {
            respostaFatura += `🔗 Link de pagamento: ${payment.payment_url}\n\n`;
          }
          
          if (payment.pix_code) {
            respostaFatura += `💳 Pix Copia e Cola:\n${payment.pix_code}\n\n`;
          }

          respostaFatura += `Atenciosamente,\nLira Tracker`;

          // Enviar mensagem com a fatura
          const { error: sendError } = await supabase.functions.invoke('whatsapp-evolution', {
            body: {
              action: 'sendText',
              payload: {
                instance_url: settings.instance_url,
                api_token: settings.api_token,
                instance_name: instanceName,
                phone: phoneNumber,
                message: respostaFatura,
                company_id: settings.company_id,
                client_id: client.id
              }
            }
          });

          if (sendError) {
            console.error('Erro ao enviar fatura:', sendError);
          } else {
            console.log('Fatura enviada com sucesso para:', phoneNumber);
          }
        } else {
          // Não há pagamentos pendentes
          const resposta = `Olá ${client.name}! 😊\n\nNo momento não há faturas pendentes em seu nome.\n\nSe tiver alguma dúvida, estamos à disposição!\n\nAtenciosamente,\nLira Tracker`;
          
          await supabase.functions.invoke('whatsapp-evolution', {
            body: {
              action: 'sendText',
              payload: {
                instance_url: settings.instance_url,
                api_token: settings.api_token,
                instance_name: instanceName,
                phone: phoneNumber,
                message: resposta,
                company_id: settings.company_id,
                client_id: client.id
              }
            }
          });
        }
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
