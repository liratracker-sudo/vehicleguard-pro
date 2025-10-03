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

      // Apenas registrar a mensagem recebida - não responder automaticamente
      console.log('Mensagem registrada:', { phoneNumber, messageText, client: client?.name || 'Não cadastrado' });
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
