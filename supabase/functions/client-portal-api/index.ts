import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET') || SUPABASE_SERVICE_ROLE_KEY

interface ClientTokenPayload {
  client_id: string
  company_id: string
  exp: number
  iat: number
}

// Simple JWT implementation for client tokens
async function createClientToken(clientId: string, companyId: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload: ClientTokenPayload = {
    client_id: clientId,
    company_id: companyId,
    iat: now,
    exp: now + (24 * 60 * 60), // 24 hours
  }

  const base64Header = btoa(JSON.stringify(header))
  const base64Payload = btoa(JSON.stringify(payload))
  
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${base64Header}.${base64Payload}`)
  )
  
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return `${base64Header}.${base64Payload}.${base64Signature}`
}

async function verifyClientToken(token: string): Promise<ClientTokenPayload | null> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.')
    if (!headerB64 || !payloadB64 || !signatureB64) return null

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    // Decode signature
    const signatureStr = signatureB64.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - signatureB64.length % 4) % 4)
    const signature = Uint8Array.from(atob(signatureStr), c => c.charCodeAt(0))

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(`${headerB64}.${payloadB64}`)
    )

    if (!isValid) return null

    const payload: ClientTokenPayload = JSON.parse(atob(payloadB64))
    
    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      console.log('Token expired')
      return null
    }

    return payload
  } catch (e) {
    console.error('Token verification error:', e)
    return null
  }
}

function normalizeDocument(doc: string): string {
  return doc.replace(/\D/g, '')
}

function parseBrazilDate(dateStr: string): string | null {
  // Accept DD/MM/YYYY or YYYY-MM-DD
  if (!dateStr) return null
  
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/')
    if (parts.length !== 3) return null
    const [day, month, year] = parts
    if (!day || !month || !year) return null
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }
  
  return null
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

// Rate limiting map (in production, use Redis/database)
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const attempt = loginAttempts.get(ip)
  
  if (!attempt || attempt.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60000 }) // 1 minute window
    return true
  }
  
  if (attempt.count >= 5) {
    return false
  }
  
  attempt.count++
  return true
}

async function handleLogin(supabase: any, body: any, ip: string) {
  const { document, birth_date, company_slug } = body

  if (!document || !birth_date) {
    return errorResponse('CPF/CNPJ e data de nascimento são obrigatórios')
  }

  // Rate limiting
  if (!checkRateLimit(ip || 'unknown')) {
    return errorResponse('Muitas tentativas de login. Aguarde 1 minuto.', 429)
  }

  const normalizedDoc = normalizeDocument(document)
  const parsedDate = parseBrazilDate(birth_date)

  if (!parsedDate) {
    return errorResponse('Formato de data inválido. Use DD/MM/AAAA')
  }

  console.log(`[client-portal] Login attempt for document: ${normalizedDoc.substring(0, 3)}***`)

  // Build query
  let query = supabase
    .from('clients')
    .select(`
      id, name, email, phone, document, birth_date, status,
      street, number, complement, neighborhood, city, state, cep,
      company_id,
      companies!inner(id, name, slug, company_branding(logo_url, primary_color))
    `)
    .ilike('document', `%${normalizedDoc}%`)
    .eq('birth_date', parsedDate)

  // Filter by company if provided
  if (company_slug) {
    query = query.eq('companies.slug', company_slug)
  }

  const { data: clients, error } = await query

  if (error) {
    console.error('Login query error:', error)
    return errorResponse('Erro ao verificar credenciais', 500)
  }

  if (!clients || clients.length === 0) {
    console.log('[client-portal] Client not found or invalid credentials')
    return errorResponse('CPF/CNPJ ou data de nascimento inválidos', 401)
  }

  // If multiple matches (rare), take the first one
  const client = clients[0]

  if (client.status === 'inactive') {
    return errorResponse('Conta inativa. Entre em contato com a empresa.', 403)
  }

  // Generate token
  const token = await createClientToken(client.id, client.company_id)

  // Get company branding
  const company = client.companies
  const branding = company?.company_branding?.[0] || {}

  console.log(`[client-portal] Login successful for client: ${client.id}`)

  return successResponse({
    token,
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      document: client.document,
    },
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      logo_url: branding.logo_url,
      primary_color: branding.primary_color,
    }
  })
}

async function handleGetProfile(supabase: any, payload: ClientTokenPayload) {
  const { data: client, error } = await supabase
    .from('clients')
    .select(`
      id, name, email, phone, document, birth_date, status,
      street, number, complement, neighborhood, city, state, cep,
      emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
      created_at
    `)
    .eq('id', payload.client_id)
    .eq('company_id', payload.company_id)
    .single()

  if (error || !client) {
    return errorResponse('Cliente não encontrado', 404)
  }

  return successResponse({
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      document: client.document,
      birth_date: client.birth_date,
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
      emergency_contact: {
        name: client.emergency_contact_name,
        phone: client.emergency_contact_phone,
        relationship: client.emergency_contact_relationship,
      },
      created_at: client.created_at,
    }
  })
}

async function handleUpdateProfile(supabase: any, payload: ClientTokenPayload, body: any) {
  const { phone, email, cep, street, number, complement, neighborhood, city, state } = body

  // Only allow updating specific fields
  const updates: any = {}
  
  if (phone !== undefined) updates.phone = phone
  if (email !== undefined) updates.email = email
  if (cep !== undefined) updates.cep = cep
  if (street !== undefined) updates.street = street
  if (number !== undefined) updates.number = number
  if (complement !== undefined) updates.complement = complement
  if (neighborhood !== undefined) updates.neighborhood = neighborhood
  if (city !== undefined) updates.city = city
  if (state !== undefined) updates.state = state

  if (Object.keys(updates).length === 0) {
    return errorResponse('Nenhum campo para atualizar')
  }

  const { data: client, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', payload.client_id)
    .eq('company_id', payload.company_id)
    .select('id, name, email, phone, street, number, complement, neighborhood, city, state, cep')
    .single()

  if (error) {
    console.error('Update profile error:', error)
    return errorResponse('Erro ao atualizar dados', 500)
  }

  console.log(`[client-portal] Profile updated for client: ${payload.client_id}`)

  return successResponse({
    message: 'Dados atualizados com sucesso',
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: {
        street: client.street,
        number: client.number,
        complement: client.complement,
        neighborhood: client.neighborhood,
        city: client.city,
        state: client.state,
        cep: client.cep,
      }
    }
  })
}

async function handleGetPayments(supabase: any, payload: ClientTokenPayload, params: URLSearchParams) {
  const status = params.get('status')
  const limit = parseInt(params.get('limit') || '20')

  let query = supabase
    .from('payment_transactions')
    .select('id, amount, due_date, status, description, payment_url, pix_code, barcode, paid_at, created_at')
    .eq('client_id', payload.client_id)
    .order('due_date', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }

  const { data: payments, error } = await query

  if (error) {
    console.error('Get payments error:', error)
    return errorResponse('Erro ao buscar faturas', 500)
  }

  // Calculate summary
  let totalPending = 0
  let totalOverdue = 0
  const now = new Date()

  for (const p of payments || []) {
    if (p.status === 'pending') {
      const dueDate = new Date(p.due_date)
      if (dueDate < now) {
        totalOverdue += p.amount
      } else {
        totalPending += p.amount
      }
    } else if (p.status === 'overdue') {
      totalOverdue += p.amount
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
    }
  })
}

async function handleGetVehicles(supabase: any, payload: ClientTokenPayload) {
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, license_plate, brand, model, year, color, has_gnv, is_armored, tracker_device_id, tracker_status, created_at')
    .eq('client_id', payload.client_id)
    .eq('company_id', payload.company_id)

  if (error) {
    console.error('Get vehicles error:', error)
    return errorResponse('Erro ao buscar veículos', 500)
  }

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
      created_at: v.created_at,
    }))
  })
}

async function handleRequestInstallation(supabase: any, payload: ClientTokenPayload, body: any) {
  const { vehicle } = body

  if (!vehicle || !vehicle.plate || !vehicle.brand || !vehicle.model) {
    return errorResponse('Dados do veículo incompletos. Informe placa, marca e modelo.')
  }

  // Get client data for the request
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('name, email, phone, document, birth_date, street, number, complement, neighborhood, city, state, cep, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship')
    .eq('id', payload.client_id)
    .single()

  if (clientError || !client) {
    return errorResponse('Erro ao buscar dados do cliente', 500)
  }

  // Create registration request with correct field names
  // Use fallback values for required fields that might be null in client data
  const { data: registration, error } = await supabase
    .from('client_registrations')
    .insert({
      company_id: payload.company_id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      document: client.document,
      birth_date: client.birth_date,
      cep: client.cep || '',
      street: client.street || '',
      number: client.number || '',
      complement: client.complement,
      neighborhood: client.neighborhood || '',
      city: client.city || '',
      state: client.state || '',
      emergency_contact_name: client.emergency_contact_name || 'Não informado',
      emergency_contact_phone: client.emergency_contact_phone || '',
      emergency_contact_relationship: client.emergency_contact_relationship || '',
      vehicle_plate: vehicle.plate.toUpperCase(),
      vehicle_brand: vehicle.brand.toUpperCase(),
      vehicle_model: vehicle.model.toUpperCase(),
      vehicle_year: vehicle.year || null,
      vehicle_color: vehicle.color?.toUpperCase() || null,
      has_gnv: vehicle.has_gnv || false,
      is_armored: vehicle.is_armored || false,
      status: 'pending',
      client_id: payload.client_id,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Create installation request error:', error)
    return errorResponse('Erro ao criar solicitação', 500)
  }

  console.log(`[client-portal] Installation request created: ${registration.id}`)

  // Send notification to company admins
  try {
    await supabase.functions.invoke('notify-registration-admin', {
      body: {
        company_id: payload.company_id,
        registration_id: registration.id,
        registration_name: client.name
      }
    })
    console.log(`[client-portal] Admin notification sent for registration: ${registration.id}`)
  } catch (notifyError) {
    console.error('Failed to notify admin:', notifyError)
    // Don't fail the request due to notification failure
  }

  return successResponse({
    request_id: registration.id,
    message: 'Solicitação de instalação enviada com sucesso! Aguarde contato para agendamento.'
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const url = new URL(req.url)
  const params = url.searchParams
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip')

  try {
    // Handle GET requests
    if (req.method === 'GET') {
      const action = params.get('action')

      // Public endpoint: Check if token is valid
      if (action === 'verify') {
        const authHeader = req.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        
        if (!token) {
          return errorResponse('Token não fornecido', 401)
        }

        const payload = await verifyClientToken(token)
        if (!payload) {
          return errorResponse('Token inválido ou expirado', 401)
        }

        return successResponse({ valid: true, client_id: payload.client_id })
      }

      // All other GET endpoints require authentication
      const authHeader = req.headers.get('authorization')
      const token = authHeader?.replace('Bearer ', '')

      if (!token) {
        return errorResponse('Token não fornecido', 401)
      }

      const payload = await verifyClientToken(token)
      if (!payload) {
        return errorResponse('Token inválido ou expirado', 401)
      }

      switch (action) {
        case 'profile':
          return await handleGetProfile(supabase, payload)
        
        case 'payments':
          return await handleGetPayments(supabase, payload, params)
        
        case 'vehicles':
          return await handleGetVehicles(supabase, payload)
        
        default:
          return errorResponse('Ação inválida. Use: profile, payments, vehicles ou verify')
      }
    }

    // Handle POST/PUT requests
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await req.json()
      const action = body.action

      // Login is public
      if (action === 'login') {
        return await handleLogin(supabase, body, ip || 'unknown')
      }

      // All other endpoints require authentication
      const authHeader = req.headers.get('authorization')
      const token = authHeader?.replace('Bearer ', '')

      if (!token) {
        return errorResponse('Token não fornecido', 401)
      }

      const payload = await verifyClientToken(token)
      if (!payload) {
        return errorResponse('Token inválido ou expirado', 401)
      }

      switch (action) {
        case 'update_profile':
          return await handleUpdateProfile(supabase, payload, body)
        
        case 'request_installation':
          return await handleRequestInstallation(supabase, payload, body)
        
        default:
          return errorResponse('Ação inválida. Use: login, update_profile ou request_installation')
      }
    }

    return errorResponse('Método não permitido', 405)

  } catch (e) {
    console.error('[client-portal] Error:', e)
    return errorResponse('Erro interno do servidor', 500)
  }
})
