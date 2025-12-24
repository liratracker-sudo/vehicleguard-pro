import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Usar SERVICE_ROLE_KEY para bypass do RLS e garantir que logs sejam salvos
const supabaseUrl = Deno.env.get('SUPABASE_URL') || "https://mcdidffxwtnqhawqilln.supabase.co";
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY não configurada!');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey || '');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...payload } = await req.json();
    console.log('WhatsApp Evolution API request:', { action, payload });

    switch (action) {
      case 'get_secrets':
        return new Response(
          JSON.stringify({
            success: true,
            instance_url: Deno.env.get('WHATSAPP_EVOLUTION_URL'),
            api_token: Deno.env.get('WHATSAPP_EVOLUTION_TOKEN')
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      case 'send_message':
        return await sendMessage(payload);
      case 'sendText': {
        // Mapear parâmetros da AI collection para formato esperado
        const mappedPayload = {
          instance_url: payload.instance_url,
          api_token: payload.api_token,
          instance_name: payload.instance_name,
          phone_number: payload.number || payload.phone_number,
          message: payload.message,
          company_id: payload.company_id,
          client_id: payload.client_id,
          linkPreview: payload.linkPreview
        };
        return await sendMessage(mappedPayload);
      }
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
      case 'update_webhook':
        return await updateWebhook(payload);
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
  let { instance_url, api_token, instance_name, phone_number, message, company_id, client_id, linkPreview } = actualPayload;
  
  // Buscar credenciais dos secrets se não fornecidas ou se for placeholder
  if (!instance_url || instance_url === 'from_secrets') {
    instance_url = Deno.env.get('WHATSAPP_EVOLUTION_URL');
  }
  if (!api_token || api_token === 'from_secrets') {
    api_token = Deno.env.get('WHATSAPP_EVOLUTION_TOKEN');
  }
  
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
  
  // Delay aleatório: 6.5s ± 1.5s (entre 5s e 8s) para evitar detecção de spam
  // Reduzido de 30s para permitir mais mensagens por execução (~10-15 por batch)
  const baseDelay = 6500;
  const variation = 1500;
  const randomDelay = baseDelay + Math.floor(Math.random() * (variation * 2 + 1)) - variation;

  const messageData = {
    number: normalizedPhone,
    text: message,
    delay: randomDelay,
    linkPreview: linkPreview !== undefined ? linkPreview : true
  };
  
  console.log(`Delay configurado: ${randomDelay}ms (${(randomDelay/1000).toFixed(1)}s)`);

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
                  (result.message && typeof result.message === 'string' && result.message.includes('error')) ||
                  (result.status === 'error') ||
                  (result.status === 'failed');

  const success = response.ok && !hasError;

  // Enhanced error detection and messaging
  let errorMessage = null;
  if (!success) {
    if (result.error) {
      errorMessage = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
    } else if (result.message && typeof result.message === 'string' && result.message.includes('error')) {
      errorMessage = result.message;
    } else if (!response.ok) {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    } else {
      errorMessage = 'Erro desconhecido no envio';
    }
    console.error(`Message send failed for ${phone_number}:`, errorMessage);
  }

    // Log no banco de dados com try/catch para diagnóstico
    if (company_id) {
      try {
        const logData = {
          company_id,
          client_id,
          message_type: 'text',
          phone_number: normalizedPhone,
          message_content: message,
          status: success ? 'sent' : 'failed',
          external_message_id: result.key?.id || null,
          error_message: success ? null : errorMessage,
          response_data: result
        };
        
        console.log('Inserindo log de envio:', { 
          phone: normalizedPhone, 
          status: success ? 'sent' : 'failed',
          external_message_id: result.key?.id 
        });
        
        const { data: insertedLog, error: logError } = await supabase
          .from('whatsapp_logs')
          .insert(logData)
          .select('id')
          .single();
        
        if (logError) {
          console.error('ERRO ao inserir log de WhatsApp:', logError);
        } else {
          console.log('Log de WhatsApp inserido com sucesso:', insertedLog?.id);
        }
      } catch (logInsertError) {
        console.error('EXCEÇÃO ao inserir log de WhatsApp:', logInsertError);
      }
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

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function clearInstance(payload: any) {
  // Handle nested payload structure
  const actualPayload = payload.payload || payload;
  let { instance_url, api_token, instance_name, company_id } = actualPayload;
  
  // Buscar credenciais dos secrets se não fornecidas ou se for placeholder
  if (!instance_url || instance_url === 'from_secrets') {
    instance_url = Deno.env.get('WHATSAPP_EVOLUTION_URL');
  }
  if (!api_token || api_token === 'from_secrets') {
    api_token = Deno.env.get('WHATSAPP_EVOLUTION_TOKEN');
  }

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
  let { instance_url, api_token, instance_name } = actualPayload;
  
  // Buscar credenciais dos secrets se não fornecidas ou se for placeholder
  if (!instance_url || instance_url === 'from_secrets') {
    instance_url = Deno.env.get('WHATSAPP_EVOLUTION_URL');
  }
  if (!api_token || api_token === 'from_secrets') {
    api_token = Deno.env.get('WHATSAPP_EVOLUTION_TOKEN');
  }
  
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
  console.log('URL usada:', `${instance_url}/instance/connectionState/${instance_name}`);

  const connectionUrl = `${instance_url}/instance/connectionState/${instance_name}`;
  
  try {
    const response = await fetch(connectionUrl, {
      method: 'GET',
      headers: {
        'apikey': api_token
      }
    });

    const result = await response.json();
    console.log('Connection status:', {
      status: response.status,
      error: response.ok ? null : response.statusText,
      response: result,
      instance_name_used: instance_name
    });

    // Se a instância não existe (404), limpar dados antigos do banco
    if (response.status === 404) {
      console.log('Instância não encontrada, limpando dados antigos do banco...');
      
      // Buscar company_id pela instância antiga
      const { data: settingsData } = await supabase
        .from('whatsapp_settings')
        .select('company_id')
        .eq('instance_name', instance_name)
        .maybeSingle();

      if (settingsData?.company_id) {
        // Limpar sessões antigas
        await supabase
          .from('whatsapp_sessions')
          .delete()
          .eq('company_id', settingsData.company_id)
          .eq('instance_name', instance_name);

        console.log('Dados antigos limpos para:', instance_name);
      }
    }

    // Se conectado, atualizar webhook automaticamente
    if (result.instance?.state === 'open') {
      console.log('Instância conectada, atualizando webhook...');
      try {
        const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
        const webhookResponse = await fetch(`${instance_url}/webhook/set/${instance_name}`, {
          method: 'POST',
          headers: { 'apikey': api_token, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhook: {
              url: webhookUrl,
              enabled: true,
              webhookByEvents: true,
              webhookBase64: false,
              events: ["CONNECTION_UPDATE", "QRCODE_UPDATED", "MESSAGES_UPDATE", "MESSAGES_UPSERT", "SEND_MESSAGE"]
            }
          })
        });
        const webhookResult = await webhookResponse.json();
        console.log('Webhook atualizado automaticamente:', webhookResult);
      } catch (webhookError) {
        console.error('Erro ao atualizar webhook (não crítico):', webhookError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: response.ok,
        connected: result.instance?.state === 'open',
        state: result.instance?.state || 'unknown',
        data: result,
        instance_name: instance_name
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
  let { instance_url, api_token, instance_name, message, company_id } = actualPayload;
  
  // Buscar credenciais dos secrets se não fornecidas ou se for placeholder
  if (!instance_url || instance_url === 'from_secrets') {
    instance_url = Deno.env.get('WHATSAPP_EVOLUTION_URL');
  }
  if (!api_token || api_token === 'from_secrets') {
    api_token = Deno.env.get('WHATSAPP_EVOLUTION_TOKEN');
  }
  
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
  let { instance_url, api_token, instance_name } = actualPayload;
  
  // Buscar credenciais dos secrets se não fornecidas ou se for placeholder
  if (!instance_url || instance_url === 'from_secrets') {
    instance_url = Deno.env.get('WHATSAPP_EVOLUTION_URL');
  }
  if (!api_token || api_token === 'from_secrets') {
    api_token = Deno.env.get('WHATSAPP_EVOLUTION_TOKEN');
  }
  
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

async function updateWebhook(payload: any) {
  const actualPayload = payload.payload || payload;
  let { instance_url, api_token, instance_name, company_id } = actualPayload;
  
  // Buscar credenciais dos secrets se não fornecidas
  if (!instance_url || instance_url === 'from_secrets') {
    instance_url = Deno.env.get('WHATSAPP_EVOLUTION_URL');
  }
  if (!api_token || api_token === 'from_secrets') {
    api_token = Deno.env.get('WHATSAPP_EVOLUTION_TOKEN');
  }
  
  console.log('Atualizando webhook para instância:', instance_name);
  
  if (!instance_url || !api_token || !instance_name) {
    return new Response(
      JSON.stringify({ success: false, error: 'Parâmetros obrigatórios faltando' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
    console.log('Configurando webhook URL:', webhookUrl);
    
    // Configurar webhook na instância existente
    const response = await fetch(`${instance_url}/webhook/set/${instance_name}`, {
      method: 'POST',
      headers: {
        'apikey': api_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webhook: {
          url: webhookUrl,
          enabled: true,
          webhookByEvents: true,
          webhookBase64: false,
          events: [
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED", 
            "MESSAGES_UPDATE",
            "MESSAGES_UPSERT",
            "SEND_MESSAGE"
          ]
        }
      })
    });

    const result = await response.json();
    console.log('Resultado da configuração do webhook:', result);

    if (response.ok) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Webhook atualizado com sucesso',
          data: result
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Falha ao atualizar webhook',
          data: result
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Erro ao atualizar webhook:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function getQRCode(payload: any) {
  // Handle nested payload structure
  const actualPayload = payload.payload || payload;
  let { instance_url, api_token, instance_name, force_new = false, company_id } = actualPayload;
  
  // Buscar credenciais dos secrets se não fornecidas ou se for placeholder
  if (!instance_url || instance_url === 'from_secrets') {
    instance_url = Deno.env.get('WHATSAPP_EVOLUTION_URL');
  }
  if (!api_token || api_token === 'from_secrets') {
    api_token = Deno.env.get('WHATSAPP_EVOLUTION_TOKEN');
  }
  
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
  
  console.log(`Obtendo QR Code para instância: ${instance_name}${force_new ? ' (forçando nova)' : ''}`);
  console.log('Configurações usadas:', { instance_url, instance_name, company_id });

  try {
    // Sempre limpar dados antigos do banco antes de começar
    if (company_id) {
      console.log('Limpando dados antigos do banco...');
      await supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('company_id', company_id);
    }

    // Se force_new = true, deletar instância primeiro
    if (force_new) {
      console.log('Deletando instância antiga...');
      await fetch(`${instance_url}/instance/delete/${instance_name}`, {
        method: 'DELETE',
        headers: {
          'apikey': api_token,
          'Content-Type': 'application/json'
        }
      });
      
      // Aguardar um pouco para garantir que foi deletada
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Verificar se instância existe
    const checkResponse = await fetch(`${instance_url}/instance/connectionState/${instance_name}`, {
      headers: {
        'apikey': api_token,
        'Content-Type': 'application/json'
      }
    });

    console.log('Status da verificação após limpeza:', checkResponse.status);

    let qrCode = null;
    
    if (checkResponse.status === 404 || force_new) {
      // Instância não existe, criar nova
      console.log('Criando nova instância com configurações limpas...');
      
      // Configurar webhook URL
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
      console.log('Configurando webhook:', webhookUrl);
      
      const createResponse = await fetch(`${instance_url}/instance/create`, {
        method: 'POST',
        headers: {
          'apikey': api_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instanceName: instance_name,
          token: api_token,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          webhookUrl: webhookUrl,
          webhookByEvents: true,
          webhookEvents: [
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED",
            "MESSAGES_UPDATE",
            "MESSAGES_UPSERT",
            "SEND_MESSAGE"
          ],
          chatwootAccountId: "",
          chatwootToken: "",
          chatwootUrl: "",
          chatwootSignMsg: false
        })
      });

      const createResult = await createResponse.json();
      console.log('Resultado da criação completo:', JSON.stringify(createResult, null, 2));

      // Tentar diferentes formatos de resposta
      if (createResponse.ok) {
        if (createResult?.qrcode?.base64) {
          qrCode = createResult.qrcode.base64;
        } else if (createResult?.qrcode?.pairingCode) {
          // Algumas versões retornam pairingCode ao invés de QR
          qrCode = createResult.qrcode.pairingCode;
        } else if (createResult?.base64) {
          qrCode = createResult.base64;
        } else if (createResult?.qrcode) {
          // Tentar usar diretamente se for string
          qrCode = typeof createResult.qrcode === 'string' ? createResult.qrcode : null;
        }
        
        if (!qrCode) {
          console.log('QR Code não encontrado nos formatos esperados. Resposta:', createResult);
        }
      }
    } else {
      // Instância existe, tentar conectar
      console.log('Tentando conectar instância existente...');
      
      const connectResponse = await fetch(`${instance_url}/instance/connect/${instance_name}`, {
        method: 'GET',
        headers: {
          'apikey': api_token,
          'Content-Type': 'application/json'
        }
      });

      const connectResult = await connectResponse.json();
      console.log('Resultado da conexão completo:', JSON.stringify(connectResult, null, 2));

      // Tentar diferentes formatos de resposta
      if (connectResult?.base64) {
        qrCode = connectResult.base64;
      } else if (connectResult?.qrcode?.base64) {
        qrCode = connectResult.qrcode.base64;
      } else if (connectResult?.qrcode?.pairingCode) {
        qrCode = connectResult.qrcode.pairingCode;
      } else if (connectResult?.qrcode) {
        qrCode = typeof connectResult.qrcode === 'string' ? connectResult.qrcode : null;
      }
      
      if (!qrCode && connectResponse.ok) {
        console.log('QR Code não encontrado na resposta de conexão. Resposta:', connectResult);
      }
    }

    if (qrCode) {
      console.log('QR Code obtido com sucesso para nova sessão limpa');
      
      // Salvar/atualizar no banco de dados
      if (company_id) {
        console.log('Salvando configurações no banco...');
        
        // Buscar configurações existentes primeiro
        const { data: existingSettings } = await supabase
          .from('whatsapp_settings')
          .select('id')
          .eq('company_id', company_id)
          .maybeSingle();

        const settingsData = {
          company_id,
          instance_name,
          instance_url,
          api_token,
          connection_status: 'connecting',
          is_active: true,
          enable_logs: true,
          enable_delivery_status: true,
          updated_at: new Date().toISOString()
        };

        // Atualizar whatsapp_settings com status 'connecting'
        let settingsError;
        if (existingSettings?.id) {
          const { error } = await supabase
            .from('whatsapp_settings')
            .update(settingsData)
            .eq('id', existingSettings.id);
          settingsError = error;
        } else {
          const { error } = await supabase
            .from('whatsapp_settings')
            .insert(settingsData);
          settingsError = error;
        }

        if (settingsError) {
          console.error('Erro ao salvar whatsapp_settings:', settingsError);
        } else {
          console.log('whatsapp_settings salvo com sucesso');
        }

        // Salvar sessão temporária em whatsapp_sessions
        const { error: sessionError } = await supabase
          .from('whatsapp_sessions')
          .insert({
            company_id,
            instance_name,
            session_id: `${instance_name}_${Date.now()}`,
            token: api_token,
            status: 'connecting',
            qr_code: qrCode,
            expires_at: new Date(Date.now() + 60000).toISOString() // QR expira em 1 minuto
          });

        if (sessionError) {
          console.error('Erro ao salvar whatsapp_sessions:', sessionError);
        } else {
          console.log('whatsapp_sessions salvo com sucesso');
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        qrCode: qrCode,
        instance_name: instance_name
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'QR Code não encontrado na resposta da API',
        hint: 'Tente usar "Nova Instância" para forçar recriação'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('Erro ao obter QR Code:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro interno do servidor'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}