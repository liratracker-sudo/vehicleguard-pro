import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = "https://mcdidffxwtnqhawqilln.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw";

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...payload } = await req.json();
    console.log('WhatsApp Evolution API request:', { action, payload });

    switch (action) {
      case 'send_message':
        return await sendMessage(payload);
      case 'check_connection':
      case 'checkConnection':
        return await checkConnection(payload);
      case 'send_status':
        return await sendStatus(payload);
      case 'get_instance_info':
        return await getInstanceInfo(payload);
      case 'get_qr_code':
      case 'getQRCode':
        return await getQRCode(payload);
      case 'createSession': {
        // Compatibilidade com chamadas antigas que enviam payload aninhado e usam "token"
        const p: any = (payload as any)?.payload ? { ...(payload as any).payload } : payload;
        if (p?.token && !p?.api_token) p.api_token = p.token;
        return await getQRCode(p);
      }
      default:
        throw new Error(`Ação não suportada: ${action}`);
    }
  } catch (error) {
    console.error('Error in whatsapp-evolution function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function sendMessage(payload: any) {
  // Handle nested payload structure
  const actualPayload = payload.payload || payload;
  const { instance_url, api_token, instance_name, phone_number, message, company_id, client_id } = actualPayload;
  
  // Validar parâmetros obrigatórios
  if (!instance_url || !api_token || !instance_name || !phone_number || !message) {
    const errorMsg = 'Parâmetros obrigatórios faltando para envio de mensagem';
    console.error(errorMsg, { 
      hasInstanceUrl: !!instance_url, 
      hasApiToken: !!api_token, 
      hasInstanceName: !!instance_name, 
      hasPhoneNumber: !!phone_number, 
      hasMessage: !!message 
    });
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMsg,
        status: 'failed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Normalizar o número de telefone (remover caracteres especiais e adicionar código do país se necessário)
  let normalizedPhone = phone_number.replace(/\D/g, ''); // Remove tudo que não é dígito
  
  // Se não tem código do país (Brasil = 55), adicionar
  if (normalizedPhone.length === 11 && normalizedPhone.startsWith('55') === false) {
    normalizedPhone = '55' + normalizedPhone;
  } else if (normalizedPhone.length === 10 && normalizedPhone.startsWith('55') === false) {
    normalizedPhone = '55' + normalizedPhone;
  }
  
  console.log('Enviando mensagem via Evolution API:', { 
    instance_name, 
    original_phone: phone_number,
    normalized_phone: normalizedPhone,
    message_length: message.length 
  });

  // First check connection before attempting to send
  try {
    const connectionCheck = await fetch(`${instance_url}/instance/connect/${instance_name}`, {
      method: 'GET',
      headers: {
        'apikey': api_token
      }
    });

    const connectionResult = await connectionCheck.json();
    console.log('Connection check before send:', connectionResult);

    // If connection is not open, fail immediately
    if (!connectionCheck.ok || connectionResult.instance?.state !== 'open') {
      const errorMsg = `WhatsApp instance not connected. State: ${connectionResult.instance?.state || 'unknown'}`;
      console.error(errorMsg);

      // Log failure
      if (company_id) {
        await supabase.from('whatsapp_logs').insert({
          company_id,
          client_id,
          message_type: 'text',
          phone_number: normalizedPhone,
          message_content: message,
          status: 'failed',
          error_message: errorMsg
        });
      }

      // Log failure
      if (company_id) {
        await supabase.from('whatsapp_logs').insert({
          company_id,
          client_id,
          message_type: 'text',
          phone_number: normalizedPhone,
          message_content: message,
          status: 'failed',
          error_message: errorMsg
        });
      }

      return new Response(
        JSON.stringify({ 
          success: false,
          error: errorMsg,
          status: 'failed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (connectionError) {
    console.error('Error checking connection:', connectionError);
    const errorMsg = 'Falha ao verificar conexão WhatsApp';

    // Log failure
    if (company_id) {
      await supabase.from('whatsapp_logs').insert({
        company_id,
        client_id,
        message_type: 'text',
        phone_number: normalizedPhone,
        message_content: message,
        status: 'failed',
        error_message: errorMsg
      });
    }

    // Log failure
    if (company_id) {
      await supabase.from('whatsapp_logs').insert({
        company_id,
        client_id,
        message_type: 'text',
        phone_number,
        message_content: message,
        status: 'failed',
        error_message: errorMsg
      });
    }

    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMsg,
        status: 'failed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const evolutionApiUrl = `${instance_url}/message/sendText/${instance_name}`;
  
  const messageData = {
    number: normalizedPhone,
    text: message,
    delay: 1000
  };

  console.log('Enviando para Evolution API:', {
    url: evolutionApiUrl,
    data: messageData,
    headers: { 'Content-Type': 'application/json', 'apikey': api_token ? 'presente' : 'ausente' }
  });

  try {
    const response = await fetch(evolutionApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': api_token
      },
      body: JSON.stringify(messageData)
    });

    const result = await response.json();
    console.log('Evolution API response status:', response.status);
    console.log('Evolution API response:', result);

  // Check for specific error patterns in the response
  const hasError = !response.ok || 
                  result.error || 
                  (result.message && result.message.includes('error')) ||
                  (result.status === 'error') ||
                  (result.status === 'failed');

  const success = response.ok && !hasError;

  // Enhanced error detection and messaging
  let errorMessage = null;
  if (!success) {
    if (result.error) {
      errorMessage = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
    } else if (result.message && result.message.includes('error')) {
      errorMessage = result.message;
    } else if (!response.ok) {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    } else {
      errorMessage = 'Erro desconhecido no envio';
    }
    console.error(`Message send failed for ${phone_number}:`, errorMessage);
  }

    // Log no banco de dados
    if (company_id) {
      await supabase.from('whatsapp_logs').insert({
        company_id,
        client_id,
        message_type: 'text',
        phone_number: normalizedPhone,
        message_content: message,
        status: success ? 'sent' : 'failed',
        external_message_id: result.key?.id || null,
        error_message: success ? null : errorMessage
      });
    }

    return new Response(
      JSON.stringify({ 
        success,
        data: result,
        status: success ? 'sent' : 'failed',
        error: success ? null : errorMessage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    
    // Log erro no banco
    if (company_id) {
      await supabase.from('whatsapp_logs').insert({
        company_id,
        client_id,
        message_type: 'text',
        phone_number: normalizedPhone,
        message_content: message,
        status: 'failed',
        error_message: error.message
      });
    }

    throw error;
  }
}

async function checkConnection(payload: any) {
  // Handle nested payload structure
  const actualPayload = payload.payload || payload;
  const { instance_url, api_token, instance_name } = actualPayload;
  
  // Validar parâmetros obrigatórios
  if (!instance_url || !api_token || !instance_name) {
    console.error('Parâmetros inválidos para verificação de conexão:', { instance_url, api_token: !!api_token, instance_name });
    return new Response(
      JSON.stringify({ 
        success: false,
        connected: false,
        error: 'Parâmetros obrigatórios faltando (instance_url, api_token, instance_name)'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  console.log('Verificando conexão Evolution API:', { instance_name });

  const connectionUrl = `${instance_url}/instance/connectionState/${instance_name}`;
  
  try {
    const response = await fetch(connectionUrl, {
      method: 'GET',
      headers: {
        'apikey': api_token
      }
    });

    const result = await response.json();
    console.log('Connection status:', result);

    return new Response(
      JSON.stringify({ 
        success: response.ok,
        connected: result.instance?.state === 'open',
        state: result.instance?.state || 'unknown',
        data: result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao verificar conexão:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        connected: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function sendStatus(payload: any) {
  // Handle nested payload structure
  const actualPayload = payload.payload || payload;
  const { instance_url, api_token, instance_name, message, company_id } = actualPayload;
  
  console.log('Enviando status via Evolution API:', { instance_name });

  const statusUrl = `${instance_url}/message/sendStatus/${instance_name}`;
  
  const statusData = {
    type: 'text',
    content: message,
    allContacts: false
  };

  try {
    const response = await fetch(statusUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': api_token
      },
      body: JSON.stringify(statusData)
    });

    const result = await response.json();
    console.log('Status response:', result);

    // Log no banco de dados
    if (company_id) {
      await supabase.from('whatsapp_logs').insert({
        company_id,
        message_type: 'status',
        phone_number: 'status@broadcast',
        message_content: message,
        status: response.ok ? 'sent' : 'failed',
        external_message_id: result.key?.id || null,
        error_message: response.ok ? null : JSON.stringify(result)
      });
    }

    return new Response(
      JSON.stringify({ 
        success: response.ok,
        data: result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao enviar status:', error);
    throw error;
  }
}

async function getInstanceInfo(payload: any) {
  // Handle nested payload structure
  const actualPayload = payload.payload || payload;
  const { instance_url, api_token, instance_name } = actualPayload;
  
  console.log('Obtendo informações da instância:', { instance_name });

  const infoUrl = `${instance_url}/instance/fetchInstances`;
  
  try {
    const response = await fetch(infoUrl, {
      method: 'GET',
      headers: {
        'apikey': api_token
      }
    });

    const result = await response.json();
    console.log('Instance info:', result);

    // Filtrar por instância específica se necessário
    const instanceData = Array.isArray(result) 
      ? result.find(inst => inst.instance?.instanceName === instance_name)
      : result;

    return new Response(
      JSON.stringify({ 
        success: response.ok,
        data: instanceData || result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao obter informações da instância:', error);
    throw error;
  }
}

async function getQRCode(payload: any) {
  // Handle nested payload structure
  const actualPayload = payload.payload || payload;
  const { instance_url, api_token, instance_name } = actualPayload;
  
  // Validar parâmetros obrigatórios
  if (!instance_url || !api_token || !instance_name) {
    console.error('Parâmetros inválidos para obter QR Code:', { instance_url, api_token: !!api_token, instance_name });
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Parâmetros obrigatórios faltando (instance_url, api_token, instance_name)'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  console.log('Obtendo QR Code da instância:', { instance_name });

  const connectUrl = `${instance_url}/instance/connect/${instance_name}`;
  
  try {
    const response = await fetch(connectUrl, {
      method: 'GET',
      headers: {
        'apikey': api_token
      }
    });

    const result = await response.json();
    console.log('QR Code response:', result);

    if (response.ok && result.code) {
      // O code retornado pela Evolution API pode ser usado para gerar QR Code
      return new Response(
        JSON.stringify({ 
          success: true,
          qrCode: result.code,
          pairingCode: result.pairingCode || null,
          base64: `data:image/png;base64,${result.base64 || ''}` // Caso a API retorne base64 diretamente
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Falha ao obter QR Code',
          data: result
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Erro ao obter QR Code:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}