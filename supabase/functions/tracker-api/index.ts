import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface ApiKeyData {
  id: string
  company_id: string
  is_active: boolean
  permissions: {
    read_clients?: boolean
    read_vehicles?: boolean
    read_payments?: boolean
    create_charges?: boolean
  }
}

// Simple hash function for API key validation
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(apiKey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function validateApiKey(supabase: any, apiKey: string): Promise<ApiKeyData | null> {
  if (!apiKey || !apiKey.startsWith('sk_')) {
    console.log('Invalid API key format')
    return null
  }

  const hashedKey = await hashApiKey(apiKey)
  
  const { data, error } = await supabase
    .from('company_api_keys')
    .select('id, company_id, is_active, permissions')
    .eq('api_key_hash', hashedKey)
    .single()

  if (error || !data) {
    console.log('API key not found:', error?.message)
    return null
  }

  if (!data.is_active) {
    console.log('API key is inactive')
    return null
  }

  // Update last_used_at
  await supabase
    .from('company_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)

  return data
}

async function logApiUsage(
  supabase: any,
  companyId: string,
  apiKeyId: string,
  endpoint: string,
  method: string,
  requestParams: any,
  responseStatus: number,
  responseTimeMs: number,
  ipAddress: string | null,
  userAgent: string | null
) {
  try {
    await supabase.from('api_usage_logs').insert({
      company_id: companyId,
      api_key_id: apiKeyId,
      endpoint,
      method,
      request_params: requestParams,
      response_status: responseStatus,
      response_time_ms: responseTimeMs,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
  } catch (e) {
    console.error('Failed to log API usage:', e)
  }
}

function errorResponse(message: string, status: number = 400) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

function successResponse(data: any) {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Calculate payment status based on payments
function calculatePaymentStatus(payments: any[]): { status: string; days_overdue: number; pending_amount: number } {
  const now = new Date()
  let pendingAmount = 0
  let maxDaysOverdue = 0

  for (const payment of payments) {
    if (payment.status === 'pending' || payment.status === 'overdue') {
      pendingAmount += payment.amount
      if (payment.due_date) {
        const dueDate = new Date(payment.due_date)
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        if (daysOverdue > 0) {
          maxDaysOverdue = Math.max(maxDaysOverdue, daysOverdue)
        }
      }
    }
  }

  let status = 'em_dia'
  if (maxDaysOverdue > 30) {
    status = 'inadimplente'
  } else if (maxDaysOverdue > 0) {
    status = 'atrasado'
  }

  return { status, days_overdue: maxDaysOverdue, pending_amount: pendingAmount }
}

async function handleGetClient(supabase: any, companyId: string, params: URLSearchParams) {
  const cpf = params.get('cpf')?.replace(/\D/g, '')
  const plate = params.get('plate')?.toUpperCase()
  const phone = params.get('phone')?.replace(/\D/g, '')
  const name = params.get('name')

  let client = null
  let vehicle = null

  if (cpf) {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', companyId)
      .ilike('document', `%${cpf}%`)
      .limit(1)
      .single()
    client = data
  } else if (phone) {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', companyId)
      .ilike('phone', `%${phone}%`)
      .limit(1)
      .single()
    client = data
  } else if (name) {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', companyId)
      .ilike('name', `%${name}%`)
      .limit(10)
    
    if (data && data.length > 0) {
      if (data.length === 1) {
        client = data[0]
      } else {
        // Return list of clients for name search
        return successResponse({
          clients: data.map((c: any) => ({
            id: c.id,
            name: c.name,
            document: c.document,
            phone: c.phone,
            email: c.email,
            status: c.status,
          }))
        })
      }
    }
  } else if (plate) {
    // Search by vehicle plate
    const { data: vehicleData } = await supabase
      .from('vehicles')
      .select('*, clients!inner(*)')
      .eq('company_id', companyId)
      .ilike('license_plate', `%${plate}%`)
      .limit(1)
      .single()

    if (vehicleData) {
      vehicle = {
        id: vehicleData.id,
        license_plate: vehicleData.license_plate,
        brand: vehicleData.brand,
        model: vehicleData.model,
        year: vehicleData.year,
        color: vehicleData.color,
        has_gnv: vehicleData.has_gnv,
        is_armored: vehicleData.is_armored,
        tracker_device_id: vehicleData.tracker_device_id,
        tracker_status: vehicleData.tracker_status,
      }
      client = vehicleData.clients
    }
  } else {
    return errorResponse('Informe cpf, phone, name ou plate para buscar o cliente')
  }

  if (!client) {
    return errorResponse('Cliente não encontrado', 404)
  }

  // Get payment status
  const { data: payments } = await supabase
    .from('payment_transactions')
    .select('amount, due_date, status')
    .eq('client_id', client.id)
    .in('status', ['pending', 'overdue'])

  const paymentInfo = calculatePaymentStatus(payments || [])

  const response: any = {
    client: {
      id: client.id,
      name: client.name,
      document: client.document,
      phone: client.phone,
      email: client.email,
      status: client.status,
      address: {
        street: client.street,
        number: client.number,
        complement: client.complement,
        neighborhood: client.neighborhood,
        city: client.city,
        state: client.state,
        cep: client.cep,
      },
      payment_status: paymentInfo.status,
      days_overdue: paymentInfo.days_overdue,
      pending_amount: paymentInfo.pending_amount,
    }
  }

  if (vehicle) {
    response.vehicle = vehicle
  }

  return successResponse(response)
}

async function handleGetVehicles(supabase: any, companyId: string, params: URLSearchParams) {
  const clientId = params.get('client_id')

  if (!clientId) {
    return errorResponse('client_id é obrigatório')
  }

  // Verify client belongs to company
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('company_id', companyId)
    .single()

  if (!client) {
    return errorResponse('Cliente não encontrado', 404)
  }

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .eq('client_id', clientId)
    .eq('company_id', companyId)

  return successResponse({
    vehicles: (vehicles || []).map((v: any) => ({
      id: v.id,
      license_plate: v.license_plate,
      brand: v.brand,
      model: v.model,
      year: v.year,
      color: v.color,
      has_gnv: v.has_gnv,
      is_armored: v.is_armored,
      tracker_device_id: v.tracker_device_id,
      tracker_status: v.tracker_status,
    }))
  })
}

async function handleGetPayments(supabase: any, companyId: string, params: URLSearchParams) {
  const clientId = params.get('client_id')
  const status = params.get('status')
  const limit = parseInt(params.get('limit') || '50')

  if (!clientId) {
    return errorResponse('client_id é obrigatório')
  }

  // Verify client belongs to company
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('company_id', companyId)
    .single()

  if (!client) {
    return errorResponse('Cliente não encontrado', 404)
  }

  let query = supabase
    .from('payment_transactions')
    .select('*')
    .eq('client_id', clientId)
    .order('due_date', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }

  const { data: payments } = await query

  // Calculate summary
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  
  let totalPending = 0
  let totalOverdue = 0
  let totalPaidThisMonth = 0

  for (const p of payments || []) {
    if (p.status === 'pending') {
      totalPending += p.amount
    } else if (p.status === 'overdue') {
      totalOverdue += p.amount
    } else if (p.status === 'paid' && p.paid_at && new Date(p.paid_at) >= startOfMonth) {
      totalPaidThisMonth += p.amount
    }
  }

  return successResponse({
    payments: (payments || []).map((p: any) => ({
      id: p.id,
      amount: p.amount,
      due_date: p.due_date,
      status: p.status,
      description: p.description,
      payment_url: p.payment_url,
      pix_code: p.pix_code,
      barcode: p.barcode,
      paid_at: p.paid_at,
      created_at: p.created_at,
    })),
    summary: {
      total_pending: totalPending,
      total_overdue: totalOverdue,
      total_paid_this_month: totalPaidThisMonth,
    }
  })
}

async function handleCreateCharge(supabase: any, companyId: string, body: any) {
  const { client_id, amount, due_date, description } = body

  if (!client_id || !amount || !due_date) {
    return errorResponse('client_id, amount e due_date são obrigatórios')
  }

  // Verify client belongs to company
  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', client_id)
    .eq('company_id', companyId)
    .single()

  if (!client) {
    return errorResponse('Cliente não encontrado', 404)
  }

  // Create payment transaction
  const { data: payment, error } = await supabase
    .from('payment_transactions')
    .insert({
      company_id: companyId,
      client_id: client_id,
      amount: amount,
      due_date: due_date,
      description: description || `Cobrança - ${client.name}`,
      status: 'pending',
      transaction_type: 'charge',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating charge:', error)
    return errorResponse('Erro ao criar cobrança: ' + error.message, 500)
  }

  return successResponse({
    charge: {
      id: payment.id,
      client_id: payment.client_id,
      amount: payment.amount,
      due_date: payment.due_date,
      description: payment.description,
      status: payment.status,
      payment_url: payment.payment_url,
      pix_code: payment.pix_code,
      created_at: payment.created_at,
    }
  })
}

async function handleUpdateCharge(supabase: any, companyId: string, body: any) {
  const { charge_id, status } = body

  if (!charge_id) {
    return errorResponse('charge_id é obrigatório')
  }

  // Verify charge belongs to company
  const { data: existing } = await supabase
    .from('payment_transactions')
    .select('id')
    .eq('id', charge_id)
    .eq('company_id', companyId)
    .single()

  if (!existing) {
    return errorResponse('Cobrança não encontrada', 404)
  }

  const updates: any = {}
  if (status) {
    updates.status = status
    if (status === 'paid') {
      updates.paid_at = new Date().toISOString()
    }
  }

  const { data: payment, error } = await supabase
    .from('payment_transactions')
    .update(updates)
    .eq('id', charge_id)
    .select()
    .single()

  if (error) {
    return errorResponse('Erro ao atualizar cobrança: ' + error.message, 500)
  }

  return successResponse({
    charge: {
      id: payment.id,
      amount: payment.amount,
      due_date: payment.due_date,
      status: payment.status,
      paid_at: payment.paid_at,
    }
  })
}

Deno.serve(async (req) => {
  const startTime = Date.now()
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  
  // Get API key from header
  const apiKey = req.headers.get('x-api-key') || req.headers.get('X-API-Key')
  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip')
  const userAgent = req.headers.get('user-agent')

  if (!apiKey) {
    return errorResponse('API Key não fornecida. Use o header X-API-Key', 401)
  }

  // Validate API key
  const apiKeyData = await validateApiKey(supabase, apiKey)
  if (!apiKeyData) {
    return errorResponse('API Key inválida ou inativa', 401)
  }

  const url = new URL(req.url)
  const params = url.searchParams
  const action = params.get('action')

  let response: Response
  let requestParams: any = { action }

  try {
    if (req.method === 'GET') {
      switch (action) {
        case 'client':
          if (!apiKeyData.permissions?.read_clients) {
            response = errorResponse('Sem permissão para ler clientes', 403)
          } else {
            requestParams = { ...requestParams, cpf: params.get('cpf'), plate: params.get('plate'), phone: params.get('phone'), name: params.get('name') }
            response = await handleGetClient(supabase, apiKeyData.company_id, params)
          }
          break

        case 'vehicles':
          if (!apiKeyData.permissions?.read_vehicles) {
            response = errorResponse('Sem permissão para ler veículos', 403)
          } else {
            requestParams = { ...requestParams, client_id: params.get('client_id') }
            response = await handleGetVehicles(supabase, apiKeyData.company_id, params)
          }
          break

        case 'payments':
          if (!apiKeyData.permissions?.read_payments) {
            response = errorResponse('Sem permissão para ler pagamentos', 403)
          } else {
            requestParams = { ...requestParams, client_id: params.get('client_id'), status: params.get('status') }
            response = await handleGetPayments(supabase, apiKeyData.company_id, params)
          }
          break

        default:
          response = errorResponse('Ação inválida. Use: client, vehicles ou payments')
      }
    } else if (req.method === 'POST') {
      const body = await req.json()
      requestParams = body

      switch (body.action) {
        case 'create_charge':
          if (!apiKeyData.permissions?.create_charges) {
            response = errorResponse('Sem permissão para criar cobranças', 403)
          } else {
            response = await handleCreateCharge(supabase, apiKeyData.company_id, body)
          }
          break

        case 'update_charge':
          if (!apiKeyData.permissions?.create_charges) {
            response = errorResponse('Sem permissão para atualizar cobranças', 403)
          } else {
            response = await handleUpdateCharge(supabase, apiKeyData.company_id, body)
          }
          break

        default:
          response = errorResponse('Ação inválida. Use: create_charge ou update_charge')
      }
    } else {
      response = errorResponse('Método não permitido', 405)
    }
  } catch (e) {
    console.error('Error processing request:', e)
    response = errorResponse('Erro interno do servidor', 500)
  }

  // Log API usage
  const responseTime = Date.now() - startTime
  const responseData = await response.clone().json()
  
  await logApiUsage(
    supabase,
    apiKeyData.company_id,
    apiKeyData.id,
    action || 'unknown',
    req.method,
    requestParams,
    response.status,
    responseTime,
    ipAddress,
    userAgent
  )

  console.log(`[tracker-api] ${req.method} action=${action} status=${response.status} time=${responseTime}ms`)

  return response
})
