import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MercadoPagoSettings {
  access_token: string
  is_sandbox: boolean
}

// ===== DEBUG LOGGING FUNCTIONS =====
const debugLog = (context: string, data: any) => {
  console.log(`[MercadoPago Debug] ${context}:`, JSON.stringify(data, null, 2))
}

const debugError = (context: string, error: any) => {
  console.error(`[MercadoPago Error] ${context}:`, JSON.stringify({
    message: error?.message || error,
    stack: error?.stack,
    details: error
  }, null, 2))
}

const maskToken = (token: string): string => {
  if (!token || token.length < 20) return '***INVALID***'
  return token.substring(0, 15) + '...' + token.substring(token.length - 4)
}

const validateTokenFormat = (token: string, isSandbox: boolean): { valid: boolean; cleanToken: string; warning?: string } => {
  const cleanToken = token.trim()
  
  debugLog('Token validation', {
    originalLength: token.length,
    cleanedLength: cleanToken.length,
    hasLeadingSpaces: token !== token.trimStart(),
    hasTrailingSpaces: token !== token.trimEnd(),
    maskedToken: maskToken(cleanToken),
    isSandbox,
    startsWithTEST: cleanToken.startsWith('TEST-'),
    startsWithAPP_USR: cleanToken.startsWith('APP_USR-')
  })
  
  let warning: string | undefined
  
  if (isSandbox && !cleanToken.startsWith('TEST-')) {
    warning = 'Token de sandbox deveria começar com TEST-. Você está usando o token correto?'
    console.warn(`[MercadoPago Warning] ${warning}`)
  }
  if (!isSandbox && !cleanToken.startsWith('APP_USR-')) {
    warning = 'Token de produção deveria começar com APP_USR-. Você está usando o token correto?'
    console.warn(`[MercadoPago Warning] ${warning}`)
  }
  
  return { valid: cleanToken.length > 20, cleanToken, warning }
}

const validateDocument = (document: string | undefined): string | null => {
  if (!document) return null
  
  const cleanDoc = document.replace(/\D/g, '')
  
  debugLog('Document validation', {
    original: document,
    cleaned: cleanDoc,
    length: cleanDoc.length,
    isCPF: cleanDoc.length === 11,
    isCNPJ: cleanDoc.length === 14,
    isValid: cleanDoc.length === 11 || cleanDoc.length === 14
  })
  
  if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
    console.warn(`[MercadoPago Warning] Documento com tamanho inválido: ${cleanDoc.length} dígitos`)
    return null
  }
  
  return cleanDoc
}

const parseAPIResponse = async (response: Response, context: string): Promise<any> => {
  const responseText = await response.text()
  const contentType = response.headers.get('content-type') || ''
  
  debugLog(`${context} - API Response`, {
    status: response.status,
    statusText: response.statusText,
    contentType,
    bodyLength: responseText.length,
    bodyPreview: responseText.substring(0, 500)
  })
  
  // Verificar se é HTML (indica token inválido ou erro de autenticação)
  if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
    debugError(`${context} - HTML Response Detected`, {
      hint: 'Resposta HTML geralmente indica token inválido ou expirado',
      body: responseText.substring(0, 300)
    })
    throw new Error('Token inválido ou expirado. Verifique se o Access Token está correto e corresponde ao ambiente selecionado.')
  }
  
  try {
    return JSON.parse(responseText)
  } catch (parseError) {
    debugError(`${context} - JSON Parse Error`, {
      parseError,
      responseText: responseText.substring(0, 500)
    })
    throw new Error('Erro ao processar resposta da API. Verifique suas credenciais.')
  }
}

const getMercadoPagoBaseUrl = (isSandbox: boolean) => {
  return 'https://api.mercadopago.com'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, company_id, ...params } = await req.json()
    
    debugLog('Request received', { action, hasCompanyId: !!company_id })
    
    let companyId: string

    // Se company_id foi fornecido (chamada de outra edge function), usa ele
    if (company_id) {
      companyId = company_id
      debugLog('Service call', { action, companyId })
    } else {
      // Caso contrário, autentica o usuário (chamada do frontend)
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        throw new Error('Missing authorization header or company_id')
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      )

      if (authError || !user) {
        debugError('Auth error', authError)
        throw new Error('Unauthorized')
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile?.company_id) {
        throw new Error('Company not found')
      }

      companyId = profile.company_id
      debugLog('User call', { action, companyId, userId: user.id })
    }

    const getSettings = async (): Promise<MercadoPagoSettings> => {
      debugLog('getSettings', { companyId })
      
      const { data: settings } = await supabase
        .from('mercadopago_settings')
        .select('access_token_encrypted, is_sandbox')
        .eq('company_id', companyId)
        .single()

      if (!settings) {
        throw new Error('MercadoPago não configurado')
      }

      const { data: decrypted } = await supabase.rpc('decrypt_mercadopago_credential', {
        p_company_id: companyId,
        p_encrypted_credential: settings.access_token_encrypted
      })

      debugLog('Settings loaded', { 
        isSandbox: settings.is_sandbox,
        hasDecryptedToken: !!decrypted
      })

      return {
        access_token: decrypted || '',
        is_sandbox: settings.is_sandbox
      }
    }

    const logOperation = async (operation: string, status: string, requestData?: any, responseData?: any, errorMessage?: string) => {
      await supabase.from('mercadopago_logs').insert({
        company_id: companyId,
        operation_type: operation,
        status,
        request_data: requestData,
        response_data: responseData,
        error_message: errorMessage
      })
    }

    switch (action) {
      case 'save_settings': {
        debugLog('save_settings - Start', { 
          hasToken: !!params.access_token,
          isSandbox: params.is_sandbox,
          webhookEnabled: params.webhook_enabled
        })

        const { access_token, is_sandbox, webhook_enabled } = params

        if (!access_token) {
          throw new Error('Access token é obrigatório')
        }

        const { valid, cleanToken, warning } = validateTokenFormat(access_token, is_sandbox ?? true)
        
        if (!valid) {
          throw new Error('Access Token inválido. Verifique se você copiou o token completo.')
        }

        debugLog('save_settings - Encrypting token', { tokenLength: cleanToken.length })

        // Criptografar access token usando chave única da empresa
        const { data: encrypted, error: encryptError } = await supabase.rpc('encrypt_mercadopago_credential', {
          p_company_id: companyId,
          p_credential: cleanToken
        })

        if (encryptError) {
          debugError('save_settings - Encryption Error', encryptError)
          throw new Error(`Erro ao criptografar credencial: ${encryptError.message}`)
        }

        if (!encrypted) {
          debugError('save_settings - Encryption Failed', { encrypted })
          throw new Error('Falha ao criptografar credencial')
        }

        debugLog('save_settings - Token encrypted, saving to database', { encrypted: !!encrypted })

        // Salvar ou atualizar configurações
        const { error: upsertError } = await supabase
          .from('mercadopago_settings')
          .upsert({
            company_id: companyId,
            access_token_encrypted: encrypted,
            is_sandbox: is_sandbox ?? true,
            is_active: true,
            webhook_enabled: webhook_enabled ?? false,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'company_id'
          })

        if (upsertError) {
          debugError('save_settings - Upsert Error', upsertError)
          throw new Error(`Erro ao salvar configurações: ${upsertError.message}`)
        }

        debugLog('save_settings - Success', { companyId })
        await logOperation('save_settings', 'success', { is_sandbox, webhook_enabled })

        return new Response(
          JSON.stringify({ success: true, message: 'Configurações salvas com sucesso', warning }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'test_connection': {
        debugLog('test_connection - Start', { 
          hasToken: !!params.access_token,
          isSandbox: params.is_sandbox 
        })

        const testIsSandbox = params.is_sandbox ?? true
        const { valid, cleanToken, warning } = validateTokenFormat(params.access_token || '', testIsSandbox)
        
        if (!valid) {
          debugError('test_connection - Invalid Token', { tokenLength: (params.access_token || '').length })
          throw new Error('Access Token inválido. Verifique se você copiou o token completo.')
        }

        if (warning) {
          debugLog('test_connection - Token Warning', { warning })
        }

        // IMPORTANTE: Para verificar credenciais, usamos api.mercadolibre.com (não api.mercadopago.com)
        // O endpoint /users/me é parte da API do Mercado Livre, não do Mercado Pago
        const apiUrl = 'https://api.mercadolibre.com/users/me'
        
        debugLog('test_connection - API Call', { 
          url: apiUrl,
          environment: testIsSandbox ? 'sandbox' : 'production'
        })
        
        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'Content-Type': 'application/json'
          }
        })

        const result = await parseAPIResponse(response, 'test_connection')

        if (!response.ok) {
          debugError('test_connection - API Error', { status: response.status, result })
          await logOperation('test_connection', 'error', { is_sandbox: testIsSandbox }, result)
          
          // Melhorar mensagem de erro
          let errorMessage = result.message || 'Erro ao testar conexão'
          if (result.error === 'not_found' || response.status === 401) {
            errorMessage = 'Token inválido ou expirado. Verifique suas credenciais.'
          }
          throw new Error(errorMessage)
        }

        debugLog('test_connection - Success', { 
          userId: result.id,
          email: result.email,
          siteId: result.site_id
        })
        
        await logOperation('test_connection', 'success', { is_sandbox: testIsSandbox }, result)

        // Atualizar resultado do teste
        await supabase
          .from('mercadopago_settings')
          .update({
            last_test_at: new Date().toISOString(),
            test_result: result
          })
          .eq('company_id', companyId)

        return new Response(
          JSON.stringify({ success: true, data: result, warning }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'create_customer': {
        debugLog('create_customer - Start', { email: params.email })
        
        const settings = await getSettings()
        const baseUrl = getMercadoPagoBaseUrl(settings.is_sandbox)

        const customerData = {
          email: params.email,
          first_name: params.first_name,
          last_name: params.last_name,
          phone: params.phone ? {
            area_code: params.phone.area_code,
            number: params.phone.number
          } : undefined,
          identification: params.identification ? {
            type: params.identification.type,
            number: params.identification.number
          } : undefined,
          description: params.description,
          address: params.address
        }

        debugLog('create_customer - Request', customerData)

        const response = await fetch(`${baseUrl}/v1/customers`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(customerData)
        })

        const result = await parseAPIResponse(response, 'create_customer')

        if (!response.ok) {
          debugError('create_customer - API Error', result)
          await logOperation('create_customer', 'error', customerData, result)
          throw new Error(result.message || 'Erro ao criar cliente')
        }

        debugLog('create_customer - Success', { customerId: result.id })
        await logOperation('create_customer', 'success', customerData, result)

        return new Response(
          JSON.stringify({ success: true, data: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'create_preference': {
        debugLog('create_preference - Start', { items: params.items?.length })
        
        const settings = await getSettings()
        const baseUrl = getMercadoPagoBaseUrl(settings.is_sandbox)

        const preferenceData = {
          items: params.items,
          payer: params.payer,
          back_urls: params.back_urls,
          auto_return: params.auto_return || 'approved',
          payment_methods: params.payment_methods,
          notification_url: params.notification_url,
          external_reference: params.external_reference,
          statement_descriptor: params.statement_descriptor,
          expires: params.expires,
          expiration_date_from: params.expiration_date_from,
          expiration_date_to: params.expiration_date_to
        }

        debugLog('create_preference - Request', preferenceData)

        const response = await fetch(`${baseUrl}/checkout/preferences`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(preferenceData)
        })

        const result = await parseAPIResponse(response, 'create_preference')

        if (!response.ok) {
          debugError('create_preference - API Error', result)
          await logOperation('create_preference', 'error', preferenceData, result)
          throw new Error(result.message || 'Erro ao criar preferência de pagamento')
        }

        debugLog('create_preference - Success', { preferenceId: result.id })
        await logOperation('create_preference', 'success', preferenceData, result)

        return new Response(
          JSON.stringify({ success: true, data: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'get_payment': {
        const { payment_id } = params
        debugLog('get_payment - Start', { payment_id })
        
        const settings = await getSettings()
        const baseUrl = getMercadoPagoBaseUrl(settings.is_sandbox)

        const response = await fetch(`${baseUrl}/v1/payments/${payment_id}`, {
          headers: {
            'Authorization': `Bearer ${settings.access_token}`,
            'Content-Type': 'application/json'
          }
        })

        const result = await parseAPIResponse(response, 'get_payment')

        if (!response.ok) {
          debugError('get_payment - API Error', result)
          await logOperation('get_payment', 'error', { payment_id }, result)
          throw new Error(result.message || 'Erro ao buscar pagamento')
        }

        debugLog('get_payment - Success', { status: result.status })
        await logOperation('get_payment', 'success', { payment_id }, result)

        return new Response(
          JSON.stringify({ success: true, data: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'create_charge': {
        const { data } = params
        debugLog('create_charge - Start', { 
          billingType: data.billingType,
          value: data.value,
          hasCustomer: !!data.customer
        })
        
        const settings = await getSettings()
        const baseUrl = getMercadoPagoBaseUrl(settings.is_sandbox)

        // Se for PIX, criar pagamento direto via API
        if (data.billingType === 'PIX') {
          // Calcular data de expiração válida (PIX não pode ter data no passado)
          const now = new Date()
          const expirationDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
          debugLog('create_charge - PIX expiration', { expirationDate: expirationDate.toISOString() })

          // Formatar para o padrão ISO 8601 com timezone de Brasília
          const brasiliaOffset = -3 * 60
          const localDate = new Date(expirationDate.getTime() + brasiliaOffset * 60 * 1000)
          
          const year = localDate.getUTCFullYear()
          const month = String(localDate.getUTCMonth() + 1).padStart(2, '0')
          const day = String(localDate.getUTCDate()).padStart(2, '0')
          const hours = String(localDate.getUTCHours()).padStart(2, '0')
          const minutes = String(localDate.getUTCMinutes()).padStart(2, '0')
          const seconds = String(localDate.getUTCSeconds()).padStart(2, '0')
          
          const expirationISO = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000-03:00`

          // Validar documento
          const cleanedDocument = validateDocument(data.customer?.document)

          const paymentData: any = {
            transaction_amount: Number(data.value),
            description: data.description || 'Pagamento',
            payment_method_id: 'pix',
            payer: {
              email: data.customer?.email || 'pagador@email.com',
              first_name: data.customer?.name?.split(' ')[0] || 'Cliente',
              last_name: data.customer?.name?.split(' ').slice(1).join(' ') || 'MercadoPago'
            },
            external_reference: data.externalReference,
            date_of_expiration: expirationISO
          }

          // Só adiciona identificação se o documento for válido
          if (cleanedDocument) {
            paymentData.payer.identification = {
              type: cleanedDocument.length === 11 ? 'CPF' : 'CNPJ',
              number: cleanedDocument
            }
          } else {
            debugLog('create_charge - Skipping invalid document', { 
              originalDocument: data.customer?.document 
            })
          }

          debugLog('create_charge - PIX Request', paymentData)

          const response = await fetch(`${baseUrl}/v1/payments`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${settings.access_token}`,
              'Content-Type': 'application/json',
              'X-Idempotency-Key': data.externalReference
            },
            body: JSON.stringify(paymentData)
          })

          const result = await parseAPIResponse(response, 'create_charge')

          if (!response.ok) {
            debugError('create_charge - PIX API Error', result)
            await logOperation('create_charge', 'error', paymentData, result)
            throw new Error(result.message || result.error || 'Erro ao criar pagamento PIX')
          }

          debugLog('create_charge - PIX Success', { 
            paymentId: result.id,
            status: result.status,
            hasPixCode: !!result.point_of_interaction?.transaction_data?.qr_code
          })
          await logOperation('create_charge', 'success', paymentData, result)

          // Extrair dados do PIX
          const pixData = result.point_of_interaction?.transaction_data || {}
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              charge: {
                id: result.id,
                status: result.status,
                invoice_url: result.transaction_details?.external_resource_url,
                pix_code: pixData.qr_code,
                qr_code_base64: pixData.qr_code_base64,
                ticket_url: pixData.ticket_url
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Para outros métodos (boleto, cartão), usar checkout preferences
        const cleanedDocument = validateDocument(data.customer?.document)
        
        const preferenceData: any = {
          items: [{
            title: data.description || 'Pagamento',
            quantity: 1,
            unit_price: Number(data.value),
            currency_id: 'BRL'
          }],
          payer: {
            name: data.customer?.name,
            email: data.customer?.email,
            phone: data.customer?.phone ? {
              area_code: data.customer.phone.replace(/\D/g, '').substring(0, 2),
              number: data.customer.phone.replace(/\D/g, '').substring(2)
            } : undefined
          },
          external_reference: data.externalReference,
          payment_methods: {
            excluded_payment_types: data.billingType === 'BOLETO'
              ? [{ id: 'credit_card' }, { id: 'debit_card' }]
              : [],
            installments: 1
          },
          date_of_expiration: data.dueDate ? new Date(data.dueDate).toISOString() : undefined
        }

        // Só adiciona identificação se o documento for válido
        if (cleanedDocument) {
          preferenceData.payer.identification = {
            type: cleanedDocument.length === 11 ? 'CPF' : 'CNPJ',
            number: cleanedDocument
          }
        }

        debugLog('create_charge - Preference Request', preferenceData)

        const response = await fetch(`${baseUrl}/checkout/preferences`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(preferenceData)
        })

        const result = await parseAPIResponse(response, 'create_charge')

        if (!response.ok) {
          debugError('create_charge - Preference API Error', result)
          await logOperation('create_charge', 'error', preferenceData, result)
          throw new Error(result.message || 'Erro ao criar cobrança')
        }

        debugLog('create_charge - Preference Success', { preferenceId: result.id })
        await logOperation('create_charge', 'success', preferenceData, result)

        return new Response(
          JSON.stringify({ 
            success: true, 
            charge: {
              id: result.id,
              invoice_url: settings.is_sandbox ? result.sandbox_init_point : result.init_point
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'cancel_payment': {
        const { payment_id } = params
        debugLog('cancel_payment - Start', { payment_id })
        
        const settings = await getSettings()
        const baseUrl = getMercadoPagoBaseUrl(settings.is_sandbox)

        const response = await fetch(`${baseUrl}/v1/payments/${payment_id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${settings.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'cancelled' })
        })

        const result = await parseAPIResponse(response, 'cancel_payment')

        if (!response.ok) {
          debugError('cancel_payment - API Error', result)
          await logOperation('cancel_payment', 'error', { payment_id }, result)
          throw new Error(result.message || 'Erro ao cancelar pagamento')
        }

        debugLog('cancel_payment - Success', { payment_id })
        await logOperation('cancel_payment', 'success', { payment_id }, result)

        return new Response(
          JSON.stringify({ success: true, data: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        debugError('Unknown action', { action })
        throw new Error(`Action não suportada: ${action}`)
    }
  } catch (error) {
    debugError('Request failed', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})