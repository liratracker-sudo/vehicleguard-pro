import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('MercadoPago Webhook - Request received')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log('MercadoPago Webhook - Body:', JSON.stringify(body, null, 2))

    // Mercado Pago envia notificações com diferentes tipos
    const { type, action, data, id } = body

    // Verificar se é uma notificação de pagamento
    if (type === 'payment') {
      const paymentId = data?.id || id

      if (!paymentId) {
        console.error('Payment ID não encontrado no webhook')
        return new Response(
          JSON.stringify({ error: 'Payment ID não encontrado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Processing payment notification:', paymentId)

      // Buscar detalhes do pagamento usando a API do Mercado Pago
      // Precisamos identificar qual empresa está relacionada a este pagamento
      // Isso pode ser feito através do external_reference

      const externalReference = data?.external_reference

      if (externalReference) {
        // Buscar a transação no banco de dados
        const { data: transaction } = await supabase
          .from('payment_transactions')
          .select('*, company_id')
          .eq('external_id', externalReference)
          .single()

        if (transaction) {
          console.log('Transaction found:', transaction.id, 'Company:', transaction.company_id)

          // Buscar configurações do Mercado Pago da empresa
          const { data: settings } = await supabase
            .from('mercadopago_settings')
            .select('access_token_encrypted, is_sandbox')
            .eq('company_id', transaction.company_id)
            .single()

          if (settings) {
            // Descriptografar token
            const { data: accessToken } = await supabase.rpc('decrypt_mercadopago_credential', {
              p_encrypted_credential: settings.access_token_encrypted
            })

            // Buscar detalhes do pagamento na API do Mercado Pago
            const baseUrl = 'https://api.mercadopago.com'
            const response = await fetch(`${baseUrl}/v1/payments/${paymentId}`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            })

            const paymentData = await response.json()
            console.log('Payment data from API:', JSON.stringify(paymentData, null, 2))

            // Atualizar status da transação
            let newStatus = 'pending'
            let paidAt = null

            switch (paymentData.status) {
              case 'approved':
                newStatus = 'paid'
                paidAt = paymentData.date_approved || new Date().toISOString()
                break
              case 'rejected':
              case 'cancelled':
                newStatus = 'cancelled'
                break
              case 'refunded':
                newStatus = 'refunded'
                break
              case 'in_process':
              case 'pending':
                newStatus = 'pending'
                break
            }

            const updateData: any = {
              status: newStatus,
              updated_at: new Date().toISOString()
            }

            if (paidAt) {
              updateData.paid_at = paidAt
            }

            await supabase
              .from('payment_transactions')
              .update(updateData)
              .eq('id', transaction.id)

            console.log('Transaction updated:', transaction.id, 'New status:', newStatus)

            // Log do webhook
            await supabase.from('mercadopago_logs').insert({
              company_id: transaction.company_id,
              operation_type: 'webhook',
              status: 'success',
              request_data: body,
              response_data: paymentData
            })
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('MercadoPago Webhook Error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})