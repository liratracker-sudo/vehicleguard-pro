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
    
    // Normalizar evento para lowercase para compatibilidade
    const eventType = (webhookData.event || '').toLowerCase();
    console.log('=== WEBHOOK RECEBIDO ===');
    console.log('Evento original:', webhookData.event);
    console.log('Evento normalizado:', eventType);
    console.log('Dados completos:', JSON.stringify(webhookData, null, 2));

    // CRÍTICO: Processar eventos de conexão (case-insensitive)
    if (eventType === 'connection.update' || eventType === 'connection_update') {
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

    // Processar QR Code atualizado (case-insensitive)
    if (eventType === 'qrcode.updated' || eventType === 'qrcode_updated') {
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

    // Verifica se é uma mensagem recebida (case-insensitive)
    if (eventType === 'messages.upsert' || eventType === 'messages_upsert') {
      console.log('=== MENSAGEM RECEBIDA ===');
      const message = webhookData.data;
      
      if (!message || message.key?.fromMe) {
        return new Response(JSON.stringify({ success: true, message: 'Mensagem ignorada (enviada por nós)' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const instanceName = webhookData.instance;
      const remoteJid = message.key?.remoteJid || '';
      const remoteJidAlt = message.key?.remoteJidAlt || '';
      const participantAlt = message.key?.participantAlt || '';
      const sender = webhookData.sender || '';
      const isGroup = remoteJid.includes('@g.us');
      
      // Ignorar mensagens de grupos
      if (isGroup) {
        console.log('Mensagem de grupo ignorada:', remoteJid);
        return new Response(JSON.stringify({ success: true, message: 'Mensagens de grupo são ignoradas' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // ===========================================
      // PRIORIDADE de extração do número real:
      // 1. webhookData.sender (formato tradicional @s.whatsapp.net)
      // 2. message.key.participantAlt (quando disponível)
      // 3. message.key.remoteJidAlt (se não for formato LID)
      // 4. message.key.remoteJid (fallback)
      // ===========================================
      
      console.log('=== DEBUG EXTRAÇÃO NÚMERO ===');
      console.log('webhookData.sender:', sender);
      console.log('message.key.remoteJid:', remoteJid);
      console.log('message.key.remoteJidAlt:', remoteJidAlt);
      console.log('message.key.participantAlt:', participantAlt);
      
      let phoneNumber = '';
      
      // Opção 1: Campo sender no webhook data (mais confiável quando @s.whatsapp.net)
      if (sender && sender.includes('@s.whatsapp.net')) {
        phoneNumber = sender.split('@')[0];
        console.log('Número extraído do sender:', phoneNumber);
      }
      
      // Opção 2: participantAlt (para chats com LID)
      if (!phoneNumber && participantAlt && participantAlt.includes('@s.whatsapp.net')) {
        phoneNumber = participantAlt.split('@')[0];
        console.log('Número extraído do participantAlt:', phoneNumber);
      }
      
      // Opção 3: remoteJidAlt (se não for formato LID)
      if (!phoneNumber && remoteJidAlt && !remoteJidAlt.includes('@lid') && remoteJidAlt.includes('@s.whatsapp.net')) {
        phoneNumber = remoteJidAlt.split('@')[0];
        console.log('Número extraído do remoteJidAlt:', phoneNumber);
      }
      
      // Opção 4: remoteJid tradicional (se for @s.whatsapp.net)
      if (!phoneNumber && remoteJid.includes('@s.whatsapp.net')) {
        phoneNumber = remoteJid.split('@')[0];
        console.log('Número extraído do remoteJid tradicional:', phoneNumber);
      }
      
      // Opção 5: Fallback - usar qualquer formato disponível (pode ser LID)
      if (!phoneNumber) {
        const jidToUse = remoteJidAlt || remoteJid;
        phoneNumber = jidToUse.split('@')[0];
        console.log('Número extraído do fallback (pode ser LID):', phoneNumber);
      }
      
      console.log('Número FINAL extraído:', phoneNumber);
      
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

      const managerPhones = managerSettings?.manager_phones || [];
      const isManager = managerPhones.some((phone: string) => {
        // Comparar removendo caracteres não numéricos
        const normalizedPhone = phone.replace(/\D/g, '');
        const normalizedExtracted = phoneNumber.replace(/\D/g, '');
        return normalizedPhone === normalizedExtracted || 
               normalizedPhone.endsWith(normalizedExtracted) || 
               normalizedExtracted.endsWith(normalizedPhone);
      });

      console.log('=== DEBUG VERIFICAÇÃO GESTOR ===');
      console.log('manager_phones cadastrados:', managerPhones);
      console.log('phoneNumber extraído:', phoneNumber);
      console.log('É gestor?:', isManager);

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
