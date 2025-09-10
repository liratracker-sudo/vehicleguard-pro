import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ASAAS_API_BASE = 'https://api.asaas.com/v3'
const ASAAS_SANDBOX_BASE = 'https://api-sandbox.asaas.com/v3'

// Local encryption helpers (AES-GCM using Web Crypto)
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bufToBase64(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64: string) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAesKey(secret: string) {
  const secretBytes = textEncoder.encode(secret);
  const hash = await crypto.subtle.digest('SHA-256', secretBytes);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptTokenLocal(token: string, secret: string) {
  const key = await getAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, textEncoder.encode(token));
  const combined = new Uint8Array(iv.length + new Uint8Array(cipher).length);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  return bufToBase64(combined.buffer);
}

async function decryptTokenLocal(encrypted: string, secret: string) {
  const data = new Uint8Array(base64ToBuf(encrypted));
  const iv = data.slice(0, 12);
  const cipher = data.slice(12);
  const key = await getAesKey(secret);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return textDecoder.decode(plain);
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data, company_id } = await req.json()
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    let companyId = company_id

    // If company_id not provided (regular user call), verify authentication
    if (!company_id) {
      // Verificar autenticação
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) {
        throw new Error('Usuário não autenticado')
      }

      // Buscar empresa do usuário
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile?.company_id) {
        throw new Error('Empresa não encontrada')
      }

      companyId = profile.company_id
    }

    switch (action) {
      case 'save_settings':
        return await saveSettings(supabaseClient, companyId, data)
      case 'test_connection':
        return await testConnection(supabaseClient, companyId, data)
      case 'setup_webhook':
        return await setupWebhook(supabaseClient, companyId, data)
      case 'save_webhook_token':
        return await saveWebhookToken(supabaseClient, companyId, data)
      case 'create_customer':
        return await createCustomer(supabaseClient, companyId, data)
      case 'create_charge':
        return await createCharge(supabaseClient, companyId, data)
      case 'get_customer':
        return await getCustomer(supabaseClient, companyId, data)
      case 'list_charges':
        return await listCharges(supabaseClient, companyId, data)
      case 'find_charges_by_cpf':
        return await findChargesByCpf(supabaseClient, companyId, data)
      case 'get_charge':
        return await getCharge(supabaseClient, companyId, data)
      default:
        throw new Error('Ação não suportada')
    }

  } catch (error) {
    console.error('Erro na integração Asaas:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function getAsaasSettings(supabaseClient: any, companyId: string) {
  const { data: settings } = await supabaseClient
    .from('asaas_settings')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle()

  if (!settings) {
    throw new Error('Configurações do Asaas não encontradas')
  }

  const key = Deno.env.get('ASAAS_ENCRYPTION_KEY') ?? Deno.env.get('EVOLUTION_ENCRYPTION_KEY')
  if (!key) {
    throw new Error('Chave de criptografia ausente')
  }

  try {
    const decryptedToken = await decryptTokenLocal(settings.api_token_encrypted, key)
    return {
      ...settings,
      api_token: decryptedToken,
      base_url: settings.is_sandbox ? ASAAS_SANDBOX_BASE : ASAAS_API_BASE
    }
  } catch (e) {
    console.error('Erro ao descriptografar token localmente:', e)
    throw new Error('Erro ao descriptografar token do Asaas')
  }
}

async function makeAsaasRequest(url: string, options: any) {
  console.log(`Fazendo requisição para: ${url}`)
  
  const response = await fetch(url, options)
  const responseData = await response.text()
  
  console.log(`Status: ${response.status}`)
  console.log(`Response: ${responseData}`)

  let jsonData
  try {
    jsonData = JSON.parse(responseData)
  } catch {
    jsonData = { message: responseData }
  }

  if (!response.ok) {
    throw new Error(jsonData.message || jsonData.description || `Erro ${response.status}`)
  }

  return jsonData
}

async function logAsaasOperation(supabaseClient: any, companyId: string, operation: string, requestData: any, responseData: any, status: string, error?: string) {
  await supabaseClient
    .from('asaas_logs')
    .insert({
      company_id: companyId,
      operation_type: operation,
      request_data: requestData,
      response_data: responseData,
      status,
      error_message: error
    })
}

async function testConnection(supabaseClient: any, companyId: string, data: any) {
  console.log('Testando conexão com Asaas')
  
  let settings
  try {
    if (data?.api_token) {
      // Teste com token fornecido diretamente
      settings = {
        api_token: data.api_token,
        is_sandbox: data.is_sandbox ?? true,
        base_url: data.is_sandbox ? ASAAS_SANDBOX_BASE : ASAAS_API_BASE
      }
    } else {
      // Buscar configurações salvas
      settings = await getAsaasSettings(supabaseClient, companyId)
    }
  } catch (error) {
    console.error('Erro ao obter configurações:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Configurações do Asaas não encontradas. Configure primeiro sua API key.' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const requestData = { test: 'connection' }
    
    const responseData = await makeAsaasRequest(`${settings.base_url}/myAccount`, {
      method: 'GET',
      headers: {
        'access_token': settings.api_token,
        'access-token': settings.api_token,
        'Content-Type': 'application/json'
      }
    })

    await logAsaasOperation(supabaseClient, companyId, 'test_connection', requestData, responseData, 'success')

    // Atualizar último teste
    if (!data?.api_token) {
      await supabaseClient
        .from('asaas_settings')
        .update({ 
          last_test_at: new Date().toISOString(),
          test_result: { success: true, account: responseData }
        })
        .eq('company_id', companyId)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Conexão com a API Asaas estabelecida com sucesso!',
        account: responseData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro no teste de conexão:', error)
    
    await logAsaasOperation(supabaseClient, companyId, 'test_connection', {}, null, 'error', error.message)

    return new Response(
      JSON.stringify({ 
        success: false, 
        message: `Erro na conexão: ${error.message}. Verifique se sua API key está correta.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function createCustomer(supabaseClient: any, companyId: string, data: any) {
  console.log('Criando cliente no Asaas')
  
  const settings = await getAsaasSettings(supabaseClient, companyId)
  
  const customerData = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    cpfCnpj: data.document,
    address: data.address,
    addressNumber: data.addressNumber,
    complement: data.complement,
    province: data.province,
    city: data.city,
    postalCode: data.postalCode,
    externalReference: data.externalReference
  }

  try {
    const responseData = await makeAsaasRequest(`${settings.base_url}/customers`, {
      method: 'POST',
      headers: {
        'access_token': settings.api_token,
        'access-token': settings.api_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(customerData)
    })

    await logAsaasOperation(supabaseClient, companyId, 'create_customer', customerData, responseData, 'success')

    return new Response(
      JSON.stringify({ 
        success: true, 
        customer: responseData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro ao criar cliente:', error)
    
    await logAsaasOperation(supabaseClient, companyId, 'create_customer', customerData, null, 'error', error.message)
    
    throw error
  }
}

async function createCharge(supabaseClient: any, companyId: string, data: any) {
  console.log('Criando cobrança no Asaas')
  
  const settings = await getAsaasSettings(supabaseClient, companyId)
  
  const chargeData = {
    customer: data.customerId,
    billingType: data.billingType,
    dueDate: data.dueDate,
    value: data.value,
    description: data.description,
    externalReference: data.externalReference,
    installmentCount: data.installmentCount,
    installmentValue: data.installmentValue,
    discount: data.discount,
    interest: data.interest,
    fine: data.fine
  }

  try {
    const responseData = await makeAsaasRequest(`${settings.base_url}/payments`, {
      method: 'POST',
      headers: {
        'access_token': settings.api_token,
        'access-token': settings.api_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chargeData)
    })

    await logAsaasOperation(supabaseClient, companyId, 'create_charge', chargeData, responseData, 'success')

    return new Response(
      JSON.stringify({ 
        success: true, 
        charge: responseData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro ao criar cobrança:', error)
    
    await logAsaasOperation(supabaseClient, companyId, 'create_charge', chargeData, null, 'error', error.message)
    
    throw error
  }
}

async function getCustomer(supabaseClient: any, companyId: string, data: any) {
  console.log('Buscando cliente no Asaas')
  
  const settings = await getAsaasSettings(supabaseClient, companyId)
  
  try {
    const responseData = await makeAsaasRequest(`${settings.base_url}/customers/${data.customerId}`, {
      method: 'GET',
      headers: {
        'access_token': settings.api_token,
        'access-token': settings.api_token,
        'Content-Type': 'application/json'
      }
    })

    await logAsaasOperation(supabaseClient, companyId, 'get_customer', { customerId: data.customerId }, responseData, 'success')

    return new Response(
      JSON.stringify({ 
        success: true, 
        customer: responseData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro ao buscar cliente:', error)
    
    await logAsaasOperation(supabaseClient, companyId, 'get_customer', { customerId: data.customerId }, null, 'error', error.message)
    
    throw error
  }
}

async function listCharges(supabaseClient: any, companyId: string, data: any) {
  console.log('Listando cobranças no Asaas')
  
  const settings = await getAsaasSettings(supabaseClient, companyId)
  
  const params = new URLSearchParams()
  if (data.customerId) params.append('customer', data.customerId)
  if (data.status) params.append('status', data.status)
  if (data.limit) params.append('limit', data.limit.toString())
  if (data.offset) params.append('offset', data.offset.toString())
  
  try {
    const responseData = await makeAsaasRequest(`${settings.base_url}/payments?${params.toString()}`, {
      method: 'GET',
      headers: {
        'access_token': settings.api_token,
        'access-token': settings.api_token,
        'Content-Type': 'application/json'
      }
    })

    await logAsaasOperation(supabaseClient, companyId, 'list_charges', data, responseData, 'success')

    return new Response(
      JSON.stringify({ 
        success: true, 
        charges: responseData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro ao listar cobranças:', error)
    
    await logAsaasOperation(supabaseClient, companyId, 'list_charges', data, null, 'error', error.message)
    
    throw error
  }
}

async function findChargesByCpf(supabaseClient: any, companyId: string, data: any) {
  console.log('Buscando cobranças por CPF no Asaas')

  if (!data?.cpfCnpj) {
    return new Response(
      JSON.stringify({ success: false, message: 'CPF/CNPJ é obrigatório' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const settings = await getAsaasSettings(supabaseClient, companyId)

  try {
    const cpf = String(data.cpfCnpj).replace(/\D/g, '')

    // 1) Buscar cliente pelo CPF/CNPJ
    const customersResp = await makeAsaasRequest(`${settings.base_url}/customers?cpfCnpj=${cpf}`, {
      method: 'GET',
      headers: {
        'access_token': settings.api_token,
        'access-token': settings.api_token,
        'Content-Type': 'application/json'
      }
    })

    const customers = customersResp?.data ?? (Array.isArray(customersResp) ? customersResp : [])

    if (!customers || customers.length === 0) {
      await logAsaasOperation(
        supabaseClient,
        companyId,
        'find_charges_by_cpf',
        { cpfCnpj: cpf },
        { customers: customersResp },
        'success'
      )

      return new Response(
        JSON.stringify({
          success: true,
          customerFound: false,
          message: 'Nenhuma cobrança encontrada para este CPF',
          charges: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const customer = customers[0]

    // 2) Buscar cobranças pelo customer.id
    const paymentsResp = await makeAsaasRequest(`${settings.base_url}/payments?customer=${customer.id}`, {
      method: 'GET',
      headers: {
        'access_token': settings.api_token,
        'access-token': settings.api_token,
        'Content-Type': 'application/json'
      }
    })

    const payments = paymentsResp?.data ?? (Array.isArray(paymentsResp) ? paymentsResp : [])

    await logAsaasOperation(
      supabaseClient,
      companyId,
      'find_charges_by_cpf',
      { cpfCnpj: cpf, customerId: customer.id },
      paymentsResp,
      'success'
    )

    return new Response(
      JSON.stringify({
        success: true,
        customerFound: true,
        customer,
        charges: payments
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro na busca por CPF:', error)

    await logAsaasOperation(
      supabaseClient,
      companyId,
      'find_charges_by_cpf',
      { cpfCnpj: data?.cpfCnpj },
      null,
      'error',
      (error as any).message
    )

    return new Response(
      JSON.stringify({ success: false, message: (error as any).message || 'Falha na consulta Asaas' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function ensureEncryptionKey(supabaseClient: any) {
  const key = Deno.env.get('ASAAS_ENCRYPTION_KEY') ?? Deno.env.get('EVOLUTION_ENCRYPTION_KEY')
  if (!key) {
    console.error('Chave de criptografia não configurada: defina o secret ASAAS_ENCRYPTION_KEY')
    throw new Error('Chave de criptografia ausente')
  }
  await supabaseClient.rpc('set_encryption_key_guc', { p_key: key })
}

async function saveSettings(supabaseClient: any, companyId: string, data: any) {
  if (!data?.api_token) {
    return new Response(
      JSON.stringify({ success: false, message: 'API key é obrigatória' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const key = Deno.env.get('ASAAS_ENCRYPTION_KEY') ?? Deno.env.get('EVOLUTION_ENCRYPTION_KEY')
  if (!key) {
    console.error('Chave de criptografia não configurada: defina o secret ASAAS_ENCRYPTION_KEY')
    return new Response(
      JSON.stringify({ success: false, message: 'Chave de criptografia ausente' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let encryptedToken: string
  try {
    encryptedToken = await encryptTokenLocal(data.api_token, key)
  } catch (err) {
    console.error('Erro ao criptografar token localmente:', err)
    return new Response(
      JSON.stringify({ success: false, message: 'Falha ao criptografar API key' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { error } = await supabaseClient
    .from('asaas_settings')
    .upsert({
      company_id: companyId,
      api_token_encrypted: encryptedToken,
      is_sandbox: data.is_sandbox ?? true,
      is_active: true,
      last_test_at: null,
      test_result: null
    }, { onConflict: 'company_id' })

  if (error) {
    console.error('Erro ao salvar asaas_settings:', error)
    return new Response(
      JSON.stringify({ success: false, message: 'Falha ao salvar configurações' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Configurações salvas com sucesso' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function saveWebhookToken(supabaseClient: any, companyId: string, data: any) {
  const token = String(data?.webhook_auth_token || '').trim()
  if (!token) {
    return new Response(
      JSON.stringify({ success: false, message: 'Token do webhook é obrigatório' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const webhookUrl = `https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/asaas-webhook`

  const { error } = await supabaseClient
    .from('asaas_settings')
    .update({
      webhook_auth_token: token,
      webhook_enabled: true,
      webhook_url: webhookUrl
    })
    .eq('company_id', companyId)

  if (error) {
    console.error('Erro ao salvar token do webhook:', error)
    return new Response(
      JSON.stringify({ success: false, message: 'Falha ao salvar token do webhook' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Token do webhook salvo com sucesso' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function getCharge(supabaseClient: any, companyId: string, data: any) {
  console.log('Buscando cobrança no Asaas')
  
  const settings = await getAsaasSettings(supabaseClient, companyId)
  
  if (!data?.chargeId) {
    throw new Error('ID da cobrança é obrigatório')
  }
  
  try {
    const responseData = await makeAsaasRequest(`${settings.base_url}/payments/${data.chargeId}`, {
      method: 'GET',
      headers: {
        'access_token': settings.api_token,
        'access-token': settings.api_token,
        'Content-Type': 'application/json'
      }
    })

    await logAsaasOperation(supabaseClient, companyId, 'get_charge', { chargeId: data.chargeId }, responseData, 'success')

    return new Response(
      JSON.stringify({ 
        success: true, 
        charge: responseData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro ao buscar cobrança:', error)
    
    await logAsaasOperation(supabaseClient, companyId, 'get_charge', { chargeId: data.chargeId }, null, 'error', error.message)
    
    throw error
  }
}

async function setupWebhook(supabaseClient: any, companyId: string, data: any) {
  console.log('Configurando webhook Asaas')
  
  const settings = await getAsaasSettings(supabaseClient, companyId)
  
  // Gerar/usar token para o webhook
  const webhookAuthToken = (data?.webhook_auth_token && String(data.webhook_auth_token).trim()) || crypto.randomUUID()
  const webhookUrl = `https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/asaas-webhook`
  
  const webhookData = {
    name: "Webhook Automatico - MultiCall",
    url: webhookUrl,
    enabled: true,
    interrupted: false,
    authToken: webhookAuthToken,
    sendType: "SEQUENTIALLY",
    events: [
      // Eventos válidos suportados pela API do Asaas
      "PAYMENT_CREATED",
      "PAYMENT_UPDATED",
      "PAYMENT_RECEIVED",
      "PAYMENT_CONFIRMED",
      "PAYMENT_OVERDUE",
      "PAYMENT_DELETED",
      "PAYMENT_REFUNDED",
      "PAYMENT_RESTORED"
    ]
  }

  try {
    // Verificar se já existe webhook
    const existingWebhooksResp = await makeAsaasRequest(`${settings.base_url}/webhooks`, {
      method: 'GET',
      headers: {
        'access_token': settings.api_token,
        'access-token': settings.api_token,
        'Content-Type': 'application/json'
      }
    })

    let webhookId = null
    const existingWebhooks = existingWebhooksResp?.data || []
    const existingWebhook = existingWebhooks.find((w: any) => w.url === webhookUrl)

    if (existingWebhook) {
      // Atualizar webhook existente
      const updateResp = await makeAsaasRequest(`${settings.base_url}/webhooks/${existingWebhook.id}`, {
        method: 'PUT',
        headers: {
          'access_token': settings.api_token,
          'access-token': settings.api_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookData)
      })
      webhookId = updateResp.id
      console.log('Webhook atualizado:', webhookId)
    } else {
      // Criar novo webhook
      const createResp = await makeAsaasRequest(`${settings.base_url}/webhooks`, {
        method: 'POST',
        headers: {
          'access_token': settings.api_token,
          'access-token': settings.api_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookData)
      })
      webhookId = createResp.id
      console.log('Webhook criado:', webhookId)
    }

    // Salvar configurações do webhook no banco
    const { error: updateError } = await supabaseClient
      .from('asaas_settings')
      .update({
        webhook_url: webhookUrl,
        webhook_auth_token: webhookAuthToken,
        webhook_id: webhookId,
        webhook_events: webhookData.events,
        webhook_enabled: true,
        webhook_last_setup_at: new Date().toISOString()
      })
      .eq('company_id', companyId)

    if (updateError) {
      console.error('Erro ao salvar webhook settings:', updateError)
      throw new Error('Falha ao salvar configurações do webhook')
    }

    await logAsaasOperation(
      supabaseClient, 
      companyId, 
      'setup_webhook', 
      webhookData, 
      { webhookId, webhookUrl }, 
      'success'
    )

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook configurado com sucesso!',
        webhookId,
        webhookUrl,
        authToken: webhookAuthToken
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro ao configurar webhook:', error)
    
    await logAsaasOperation(
      supabaseClient, 
      companyId, 
      'setup_webhook', 
      webhookData, 
      null, 
      'error', 
      error.message
    )
    
    throw error
  }
}