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
      case 'clear_instance':
        return await clearInstance(payload);
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
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
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
      { 
        status: 400, // Bad Request para parâmetros faltando
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
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

    // If connection is not open, fail immediately with detailed state info
    const isConnected = connectionCheck.ok && connectionResult.instance?.state === 'open';
    
    if (!isConnected) {
      const state = connectionResult.instance?.state || 'unknown';
      const errorMsg = `WhatsApp não autenticado — reconectar o número para continuar os envios. Estado atual: ${state}`;
      console.error(errorMsg, { 
        httpStatus: connectionCheck.status,
        state: state,
        fullResponse: connectionResult 
      });

      // Log failure with detailed info
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
        { 
          status: 503, // Service Unavailable para problemas de conexão
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
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
      { 
        status: 503, // Service Unavailable para falha de conexão
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
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
        error_message: error instanceof Error ? error.message : String(error)
      });
    }

    throw error;
  }
}

async function clearInstance(payload: any) {
  // Handle nested payload structure
  const actualPayload = payload.payload || payload;
  const { instance_url, api_token, instance_name, company_id } = actualPayload;

  console.log('Limpando instância:', { 
    instance_url, 
    instance_name,
    company_id,
    timestamp: new Date().toISOString()
  });

  if (!instance_url || !api_token || !instance_name) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Parâmetros obrigatórios: instance_url, api_token, instance_name' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // 1. Deletar instância no servidor Evolution (se existir)
    try {
      const deleteUrl = `${instance_url}/instance/delete/${instance_name}`;
      console.log('Tentando deletar instância no servidor:', deleteUrl);
      
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'apikey': api_token
        }
      });

      console.log('Resposta da deleção no servidor:', {
        status: deleteResponse.status,
        statusText: deleteResponse.statusText
      });
    } catch (error) {
      console.log('Erro ao deletar no servidor (pode não existir):', error);
      // Continuar mesmo se der erro, pois a instância pode não existir
    }

    // 2. Limpar dados locais do banco
    if (company_id) {
      console.log('Limpando dados locais para company_id:', company_id);
      
      // Deletar sessões
      const { error: sessionError } = await supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('company_id', company_id)
        .eq('instance_name', instance_name);

      if (sessionError) {
        console.error('Erro ao limpar sessões:', sessionError);
      }

      // Atualizar configurações para desconectado
      const { error: settingsError } = await supabase
        .from('whatsapp_settings')
        .update({ 
          connection_status: 'disconnected',
          updated_at: new Date().toISOString()
        })
        .eq('company_id', company_id)
        .eq('instance_name', instance_name);

      if (settingsError) {
        console.error('Erro ao atualizar configurações:', settingsError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Instância limpa com sucesso. Agora você pode configurar uma nova instância.' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro ao limpar instância:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erro interno ao limpar instância: ' + (error as Error).message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
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
        error: error instanceof Error ? error.message : String(error)
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
  const { instance_url, api_token, instance_name, force_new = false } = actualPayload;
  
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
  
  console.log('🔄 Solicitando QR Code:', { instance_name, force_new });
  
  try {
    // Se force_new for true, primeiro deletar a instância existente
    if (force_new) {
      console.log('🗑️ Forçando nova instância - deletando instância existente');
      try {
        const deleteUrl = `${instance_url}/instance/delete/${instance_name}`;
        const deleteResponse = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': api_token,
          },
        });
        console.log('🗑️ Delete response:', deleteResponse.status);
        // Aguardar um pouco após deletar
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (deleteError) {
        console.log('⚠️ Erro ao deletar instância (pode não existir):', deleteError);
      }
    }

    // Primeiro, tentar criar/obter a instância
    const createUrl = `${instance_url}/instance/create`;
    console.log('🆕 Criando/verificando instância em:', createUrl);
    
    const createPayload = {
      instanceName: instance_name,
      token: api_token,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS'
    };

    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': api_token,
      },
      body: JSON.stringify(createPayload)
    });

    console.log('🆕 Create response:', createResponse.status, createResponse.statusText);
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.log('❌ Create error response:', errorText);
      
      // Se já existe, continuar para obter QR Code
      if (!createResponse.status.toString().includes('409') && !errorText.includes('already exists')) {
        throw new Error(`Erro ao criar instância: ${createResponse.status} ${createResponse.statusText}`);
      }
    }

    // Aguardar um pouco para a instância se inicializar
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Agora verificar status da instância
    const statusUrl = `${instance_url}/instance/connectionState/${instance_name}`;
    console.log('🔍 Verificando status em:', statusUrl);
    
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': api_token,
      },
    });

    console.log('📊 Status response:', statusResponse.status, statusResponse.statusText);
    
    if (!statusResponse.ok) {
      throw new Error(`Instância "${instance_name}" não foi encontrada. Verifique se o nome está correto.`);
    }
    
    const statusData = await statusResponse.json();
    console.log('📊 Status data:', JSON.stringify(statusData, null, 2));

    // Se já estiver conectado, retornar erro informativo
    if (statusData?.instance?.state === 'open') {
      console.log('✅ Instância já conectada');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'WhatsApp já está conectado. Desconecte primeiro se quiser gerar um novo QR Code.',
          data: statusData,
          hint: 'A instância já está conectada ao WhatsApp'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Tentar obter QR Code
    const qrUrl = `${instance_url}/instance/connect/${instance_name}`;
    console.log('🔗 Solicitando QR Code em:', qrUrl);
    
    const qrResponse = await fetch(qrUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': api_token,
      },
    });

    console.log('📱 QR response:', qrResponse.status, qrResponse.statusText);
    
    if (!qrResponse.ok) {
      const errorText = await qrResponse.text();
      console.log('❌ QR error response:', errorText);
      
      throw new Error(`Erro ao obter QR Code: ${qrResponse.status} ${qrResponse.statusText}`);
    }

    const qrData = await qrResponse.json();
    console.log('📱 QR data recebida:', JSON.stringify(qrData, null, 2));

    // Verificar diferentes formatos de resposta da Evolution API
    let qrCode = null;
    
    // Formato 1: { code: "qr_code_string" }
    if (qrData?.code) {
      qrCode = qrData.code;
    }
    // Formato 2: { qrcode: { code: "qr_code_string" } }
    else if (qrData?.qrcode?.code) {
      qrCode = qrData.qrcode.code;
    }
    // Formato 3: { qr: "qr_code_string" }
    else if (qrData?.qr) {
      qrCode = qrData.qr;
    }
    // Formato 4: { qrCode: "qr_code_string" }
    else if (qrData?.qrCode) {
      qrCode = qrData.qrCode;
    }
    // Formato 5: resposta direta como string
    else if (typeof qrData === 'string') {
      qrCode = qrData;
    }

    if (qrCode) {
      console.log('✅ QR Code obtido com sucesso');
      return new Response(
        JSON.stringify({
          success: true,
          qrCode: qrCode,
          pairingCode: qrData?.pairingCode || null,
          base64: qrData?.base64 || null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log('❌ QR Code não encontrado na resposta');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Evolution API não retornou QR Code. Tente novamente em alguns segundos.',
          data: qrData,
          hint: 'A instância pode estar inicializando. Aguarde alguns segundos e tente novamente.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('❌ Erro ao obter QR Code:', error.message);
    
    // Verificar se é erro de instância não encontrada
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Instância "${instance_name}" não encontrada. Verifique o nome da instância.`,
          data: {
            status: 404,
            error: 'Not Found',
            response: {
              message: [`The "${instance_name}" instance does not exist`]
            }
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno ao obter QR Code',
        data: null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}