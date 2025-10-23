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

    // CRÍTICO: Processar eventos de conexão
    if (webhookData.event === 'connection.update' || webhookData.event === 'CONNECTION_UPDATE') {
      console.log('Processando atualização de conexão:', webhookData.data);
      
      const instanceName = webhookData.instance || webhookData.data?.instanceName;
      const state = webhookData.data?.state || webhookData.data?.instance?.state;
      
      if (instanceName && state) {
        console.log(`Atualizando status da instância ${instanceName} para ${state}`);
        
        // Buscar company_id pela instância
        const { data: settingsData } = await supabase
          .from('whatsapp_settings')
          .select('company_id')
          .eq('instance_name', instanceName)
          .maybeSingle();

        if (settingsData?.company_id) {
          const connectionStatus = state === 'open' ? 'connected' : 'disconnected';
          
          // Atualizar whatsapp_settings
          const { error: settingsError } = await supabase
            .from('whatsapp_settings')
            .update({
              connection_status: connectionStatus,
              updated_at: new Date().toISOString()
            })
            .eq('company_id', settingsData.company_id);

          if (settingsError) {
            console.error('Erro ao atualizar whatsapp_settings:', settingsError);
          } else {
            console.log(`whatsapp_settings atualizado para ${connectionStatus}`);
          }

          // Atualizar whatsapp_sessions se conectado
          if (state === 'open') {
            const { error: sessionError } = await supabase
              .from('whatsapp_sessions')
              .update({
                status: 'connected',
                connected_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('company_id', settingsData.company_id)
              .eq('instance_name', instanceName);

            if (sessionError) {
              console.error('Erro ao atualizar whatsapp_sessions:', sessionError);
            } else {
              console.log('whatsapp_sessions atualizado para connected');
            }
          }
        }
      }
      
      return new Response(JSON.stringify({ success: true, message: 'Conexão processada' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Processar QR Code atualizado
    if (webhookData.event === 'qrcode.updated' || webhookData.event === 'QRCODE_UPDATED') {
      console.log('QR Code atualizado:', webhookData.data);
      
      const instanceName = webhookData.instance || webhookData.data?.instanceName;
      const qrCode = webhookData.data?.qrcode?.base64 || webhookData.data?.qrcode;
      
      if (instanceName && qrCode) {
        const { data: settingsData } = await supabase
          .from('whatsapp_settings')
          .select('company_id')
          .eq('instance_name', instanceName)
          .maybeSingle();

        if (settingsData?.company_id) {
          await supabase
            .from('whatsapp_sessions')
            .update({
              qr_code: qrCode,
              expires_at: new Date(Date.now() + 60000).toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('company_id', settingsData.company_id)
            .eq('instance_name', instanceName);
        }
      }
      
      return new Response(JSON.stringify({ success: true, message: 'QR Code processado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

      // Verificar se é um dos números dos gestores
      const { data: managerSettings } = await supabase
        .from('ai_weekly_reports')
        .select('manager_phones, is_active')
        .eq('company_id', settings.company_id)
        .eq('is_active', true)
        .single();

      const isManager = managerSettings?.manager_phones?.includes(phoneNumber) || false;

      // Registrar log da mensagem recebida
      await supabase.from('whatsapp_logs').insert({
        company_id: settings.company_id,
        client_id: client?.id || null,
        phone_number: phoneNumber,
        message_type: 'received',
        message_content: messageText,
        status: 'received',
      });

      // Se for o gestor, processar comando com IA
      if (isManager && messageText) {
        console.log('Mensagem do gestor recebida:', { phoneNumber, messageText });
        
        try {
          // Chamar edge function para processar comando do gestor
          const response = await supabase.functions.invoke('ai-manager-assistant', {
            body: {
              company_id: settings.company_id,
              message: messageText,
              manager_phone: phoneNumber,
              instance_url: settings.instance_url,
              api_token: settings.api_token,
              instance_name: instanceName
            }
          });

          console.log('Resposta do assistente IA:', response);
        } catch (error) {
          console.error('Erro ao processar comando do gestor:', error);
        }
      } else {
        // Apenas registrar a mensagem recebida - não responder automaticamente
        console.log('Mensagem registrada:', { phoneNumber, messageText, client: client?.name || 'Não cadastrado' });
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
