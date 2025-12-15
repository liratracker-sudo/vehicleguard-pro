import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || "https://mcdidffxwtnqhawqilln.supabase.co";
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, message, company_id } = await req.json();

    console.log('=== DIAGNÓSTICO DE ENVIO WHATSAPP ===');
    console.log('Número original:', phone_number);
    console.log('Mensagem:', message?.substring(0, 50) + '...');
    console.log('Company ID:', company_id);

    // Buscar configurações do WhatsApp
    const { data: settings, error: settingsError } = await supabase
      .from('whatsapp_settings')
      .select('*')
      .eq('company_id', company_id)
      .single();

    if (settingsError || !settings) {
      console.error('Erro ao buscar configurações:', settingsError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Configurações do WhatsApp não encontradas',
        details: { settingsError }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('Configurações encontradas:', {
      instance_name: settings.instance_name,
      is_active: settings.is_active
    });

    // Obter credenciais
    const evolutionBaseUrl = settings.evolution_base_url || Deno.env.get('EVOLUTION_BASE_URL') || Deno.env.get('WHATSAPP_EVOLUTION_URL');
    const evolutionToken = settings.evolution_token || Deno.env.get('WHATSAPP_EVOLUTION_TOKEN');
    const instanceName = settings.instance_name;

    if (!evolutionBaseUrl || !evolutionToken || !instanceName) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Credenciais incompletas',
        details: {
          hasBaseUrl: !!evolutionBaseUrl,
          hasToken: !!evolutionToken,
          hasInstanceName: !!instanceName
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Normalizar número
    let normalizedPhone = phone_number.replace(/\D/g, '');
    if (normalizedPhone.length === 11 && !normalizedPhone.startsWith('55')) {
      normalizedPhone = '55' + normalizedPhone;
    } else if (normalizedPhone.length === 10 && !normalizedPhone.startsWith('55')) {
      normalizedPhone = '55' + normalizedPhone;
    }

    console.log('Número normalizado:', normalizedPhone);

    // Verificar status da conexão
    console.log('Verificando status da conexão...');
    const connectionUrl = `${evolutionBaseUrl}/instance/connectionState/${instanceName}`;
    console.log('URL de conexão:', connectionUrl);

    let connectionStatus = null;
    try {
      const connectionResponse = await fetch(connectionUrl, {
        method: 'GET',
        headers: {
          'apikey': evolutionToken
        }
      });
      connectionStatus = await connectionResponse.json();
      console.log('Status da conexão:', JSON.stringify(connectionStatus, null, 2));
    } catch (connError) {
      console.error('Erro ao verificar conexão:', connError);
      connectionStatus = { error: String(connError) };
    }

    // Obter informações da instância
    console.log('Obtendo informações da instância...');
    let instanceInfo = null;
    try {
      const instanceUrl = `${evolutionBaseUrl}/instance/fetchInstances?instanceName=${instanceName}`;
      const instanceResponse = await fetch(instanceUrl, {
        method: 'GET',
        headers: {
          'apikey': evolutionToken
        }
      });
      instanceInfo = await instanceResponse.json();
      console.log('Info da instância:', JSON.stringify(instanceInfo, null, 2));
    } catch (instError) {
      console.error('Erro ao obter info da instância:', instError);
      instanceInfo = { error: String(instError) };
    }

    // Enviar mensagem de teste
    console.log('Enviando mensagem de teste...');
    const sendUrl = `${evolutionBaseUrl}/message/sendText/${instanceName}`;
    console.log('URL de envio:', sendUrl);

    const sendPayload = {
      number: normalizedPhone,
      text: message || `🔧 Teste de diagnóstico - ${new Date().toLocaleString('pt-BR')}`
    };
    console.log('Payload de envio:', JSON.stringify(sendPayload, null, 2));

    const startTime = Date.now();
    const sendResponse = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'apikey': evolutionToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sendPayload)
    });
    const responseTime = Date.now() - startTime;

    const sendResult = await sendResponse.json();
    console.log('Resposta do envio:', JSON.stringify(sendResult, null, 2));
    console.log('Tempo de resposta:', responseTime, 'ms');
    console.log('HTTP Status:', sendResponse.status);

    // Determinar sucesso
    const success = sendResponse.ok && sendResult.key?.id;

    // Salvar log no banco
    const logData = {
      company_id,
      message_type: 'diagnostic_test',
      phone_number: normalizedPhone,
      message_content: sendPayload.text,
      status: success ? 'sent' : 'failed',
      external_message_id: sendResult.key?.id || null,
      error_message: success ? null : JSON.stringify(sendResult),
      response_data: {
        evolution_response: sendResult,
        connection_status: connectionStatus,
        instance_info: instanceInfo,
        http_status: sendResponse.status,
        response_time_ms: responseTime
      }
    };

    const { data: logResult, error: logError } = await supabase
      .from('whatsapp_logs')
      .insert(logData)
      .select('id')
      .single();

    console.log('Log salvo:', logResult?.id, 'Erro:', logError);

    return new Response(JSON.stringify({
      success,
      diagnostic: {
        original_phone: phone_number,
        normalized_phone: normalizedPhone,
        instance_name: instanceName,
        evolution_base_url: evolutionBaseUrl?.replace(/https?:\/\//, '***'),
        connection_status: connectionStatus,
        instance_info: instanceInfo,
        send_result: sendResult,
        http_status: sendResponse.status,
        response_time_ms: responseTime,
        message_id: sendResult.key?.id || null,
        log_saved: !!logResult?.id,
        log_id: logResult?.id
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro no diagnóstico:', error);
    return new Response(JSON.stringify({
      success: false,
      error: String(error),
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
