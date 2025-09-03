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
        return await checkConnection(payload);
      case 'send_status':
        return await sendStatus(payload);
      case 'get_instance_info':
        return await getInstanceInfo(payload);
      case 'get_qr_code':
        return await getQRCode(payload);
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
  const { instance_url, api_token, instance_name, phone_number, message, company_id, client_id } = payload;
  
  console.log('Enviando mensagem via Evolution API:', { instance_name, phone_number });

  const evolutionApiUrl = `${instance_url}/message/sendText/${instance_name}`;
  
  const messageData = {
    number: phone_number,
    text: message,
    delay: 1000
  };

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
    console.log('Evolution API response:', result);

    // Log no banco de dados
    if (company_id) {
      await supabase.from('whatsapp_logs').insert({
        company_id,
        client_id,
        message_type: 'text',
        phone_number,
        message_content: message,
        status: response.ok ? 'sent' : 'failed',
        external_message_id: result.key?.id || null,
        error_message: response.ok ? null : JSON.stringify(result)
      });
    }

    return new Response(
      JSON.stringify({ 
        success: response.ok,
        data: result,
        status: response.ok ? 'sent' : 'failed'
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
        phone_number,
        message_content: message,
        status: 'failed',
        error_message: error.message
      });
    }

    throw error;
  }
}

async function checkConnection(payload: any) {
  const { instance_url, api_token, instance_name } = payload;
  
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
  const { instance_url, api_token, instance_name, message, company_id } = payload;
  
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
  const { instance_url, api_token, instance_name } = payload;
  
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
  const { instance_url, api_token, instance_name } = payload;
  
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