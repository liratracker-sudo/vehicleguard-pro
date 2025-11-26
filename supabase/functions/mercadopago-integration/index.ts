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
    
    let companyId: string

    // Se company_id foi fornecido (chamada de outra edge function), usa ele
    if (company_id) {
      companyId = company_id
      console.log('MercadoPago Integration - Service call - Action:', action, 'Company:', companyId)
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
      console.log('MercadoPago Integration - User call - Action:', action, 'Company:', companyId)
    }

    const getSettings = async (): Promise<MercadoPagoSettings> => {
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

    const getMercadoPagoBaseUrl = (isSandbox: boolean) => {
      return isSandbox 
        ? 'https://api.mercadopago.com' 
        : 'https://api.mercadopago.com'
    }

    switch (action) {
      case 'save_settings': {
        const { access_token, is_sandbox, webhook_enabled } = params

        if (!access_token) {
          throw new Error('Access token é obrigatório')
        }

        // Criptografar access token usando chave única da empresa
        const { data: encrypted, error: encryptError } = await supabase.rpc('encrypt_mercadopago_credential', {
          p_company_id: companyId,
          p_credential: access_token
        })

        if (encryptError) {
          console.error('Encryption error:', encryptError)
          throw new Error(`Erro ao criptografar credencial: ${encryptError.message}`)
        }

        if (!encrypted) {
          throw new Error('Falha ao criptografar credencial')
        }

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
          console.error('Upsert error:', upsertError)
          throw new Error(`Erro ao salvar configurações: ${upsertError.message}`)
        }

        await logOperation('save_settings', 'success', { is_sandbox, webhook_enabled })

        return new Response(
          JSON.stringify({ success: true, message: 'Configurações salvas com sucesso' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'test_connection': {
        const testAccessToken = params.access_token
        const testIsSandbox = params.is_sandbox ?? true

        const baseUrl = getMercadoPagoBaseUrl(testIsSandbox)
        
        const response = await fetch(`${baseUrl}/v1/users/me`, {
          headers: {
            'Authorization': `Bearer ${testAccessToken}`,
            'Content-Type': 'application/json'
          }
        })

        const result = await response.json()

        if (!response.ok) {
          await logOperation('test_connection', 'error', { is_sandbox: testIsSandbox }, result)
          throw new Error(result.message || 'Erro ao testar conexão')
        }

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
          JSON.stringify({ success: true, data: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'create_customer': {
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

        const response = await fetch(`${baseUrl}/v1/customers`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(customerData)
        })

        const result = await response.json()

        if (!response.ok) {
          await logOperation('create_customer', 'error', customerData, result)
          throw new Error(result.message || 'Erro ao criar cliente')
        }

        await logOperation('create_customer', 'success', customerData, result)

        return new Response(
          JSON.stringify({ success: true, data: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'create_preference': {
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

        const response = await fetch(`${baseUrl}/checkout/preferences`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(preferenceData)
        })

        const result = await response.json()

        if (!response.ok) {
          await logOperation('create_preference', 'error', preferenceData, result)
          throw new Error(result.message || 'Erro ao criar preferência de pagamento')
        }

        await logOperation('create_preference', 'success', preferenceData, result)

        return new Response(
          JSON.stringify({ success: true, data: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'get_payment': {
        const settings = await getSettings()
        const baseUrl = getMercadoPagoBaseUrl(settings.is_sandbox)
        const { payment_id } = params

        const response = await fetch(`${baseUrl}/v1/payments/${payment_id}`, {
          headers: {
            'Authorization': `Bearer ${settings.access_token}`,
            'Content-Type': 'application/json'
          }
        })

        const result = await response.json()

        if (!response.ok) {
          await logOperation('get_payment', 'error', { payment_id }, result)
          throw new Error(result.message || 'Erro ao buscar pagamento')
        }

        await logOperation('get_payment', 'success', { payment_id }, result)

        return new Response(
          JSON.stringify({ success: true, data: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'create_charge': {
        const settings = await getSettings()
        const baseUrl = getMercadoPagoBaseUrl(settings.is_sandbox)
        const { data } = params

        // Se for PIX, criar pagamento direto via API
        if (data.billingType === 'PIX') {
          // Calcular data de expiração válida (PIX não pode ter data no passado)
          const now = new Date()
          let expirationDate: Date
          
          if (data.dueDate) {
            const dueDate = new Date(data.dueDate)
            // Se a data de vencimento é futura, usar ela + 1 dia
            if (dueDate > now) {
              expirationDate = new Date(dueDate.getTime() + 24 * 60 * 60 * 1000)
            } else {
              // Para cobranças vencidas, usar apenas 2 horas de expiração
              // Isso evita problemas com PIX de cobranças muito antigas
              expirationDate = new Date(now.getTime() + 2 * 60 * 60 * 1000)
              console.log(`Cobrança vencida (${data.dueDate}), PIX expira em 2 horas: ${expirationDate.toISOString()}`)
            }
          } else {
            // Se não tem dueDate, usar 2 horas
            expirationDate = new Date(now.getTime() + 2 * 60 * 60 * 1000)
          }

          // Formatar para o padrão ISO 8601 com timezone de Brasília
          // MercadoPago requer formato: yyyy-MM-dd'T'HH:mm:ss.SSS-03:00
          const brasiliaOffset = -3 * 60 // -3 horas em minutos
          const localDate = new Date(expirationDate.getTime() + brasiliaOffset * 60 * 1000)
          
          const year = localDate.getUTCFullYear()
          const month = String(localDate.getUTCMonth() + 1).padStart(2, '0')
          const day = String(localDate.getUTCDate()).padStart(2, '0')
          const hours = String(localDate.getUTCHours()).padStart(2, '0')
          const minutes = String(localDate.getUTCMinutes()).padStart(2, '0')
          const seconds = String(localDate.getUTCSeconds()).padStart(2, '0')
          
          const expirationISO = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000-03:00`

          const paymentData = {
            transaction_amount: Number(data.value),
            description: data.description || 'Pagamento',
            payment_method_id: 'pix',
            payer: {
              email: data.customer?.email || 'pagador@email.com',
              first_name: data.customer?.name?.split(' ')[0] || 'Cliente',
              last_name: data.customer?.name?.split(' ').slice(1).join(' ') || 'MercadoPago',
              identification: data.customer?.document ? {
                type: data.customer.document.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ',
                number: data.customer.document.replace(/\D/g, '')
              } : undefined
            },
            external_reference: data.externalReference,
            date_of_expiration: expirationISO
          }

          console.log('Creating PIX payment:', JSON.stringify(paymentData, null, 2))

          const response = await fetch(`${baseUrl}/v1/payments`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${settings.access_token}`,
              'Content-Type': 'application/json',
              'X-Idempotency-Key': data.externalReference
            },
            body: JSON.stringify(paymentData)
          })

          const result = await response.json()

          if (!response.ok) {
            console.error('MercadoPago payment error:', result)
            await logOperation('create_charge', 'error', paymentData, result)
            throw new Error(result.message || result.error || 'Erro ao criar pagamento PIX')
          }

          console.log('PIX payment created:', result)
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
        const preferenceData = {
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
            } : undefined,
            identification: data.customer?.document ? {
              type: data.customer.document.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ',
              number: data.customer.document.replace(/\D/g, '')
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

        const response = await fetch(`${baseUrl}/checkout/preferences`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(preferenceData)
        })

        const result = await response.json()

        if (!response.ok) {
          await logOperation('create_charge', 'error', preferenceData, result)
          throw new Error(result.message || 'Erro ao criar cobrança')
        }

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
        const settings = await getSettings()
        const baseUrl = getMercadoPagoBaseUrl(settings.is_sandbox)
        const { payment_id } = params

        const response = await fetch(`${baseUrl}/v1/payments/${payment_id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${settings.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'cancelled' })
        })

        const result = await response.json()

        if (!response.ok) {
          await logOperation('cancel_payment', 'error', { payment_id }, result)
          throw new Error(result.message || 'Erro ao cancelar pagamento')
        }

        await logOperation('cancel_payment', 'success', { payment_id }, result)

        return new Response(
          JSON.stringify({ success: true, data: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        throw new Error(`Action não suportada: ${action}`)
    }
  } catch (error) {
    console.error('MercadoPago Integration Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})