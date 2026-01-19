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
      console.log('MercadoPago Webhook - Payment ID:', paymentId)

      if (!paymentId) {
        console.error('Payment ID não encontrado no webhook')
        return new Response(
          JSON.stringify({ success: true, message: 'Payment ID não encontrado' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Processing payment notification for ID:', paymentId)

      // Buscar a transação no banco usando o external_id (que é o payment ID do Mercado Pago)
      const { data: transaction, error: transactionError } = await supabase
        .from('payment_transactions')
        .select('*, company_id')
        .eq('external_id', paymentId.toString())
        .single()

      console.log('Transaction search result:', transaction ? 'Found' : 'Not found', transactionError)

      if (!transaction) {
        console.log('Transaction not found for payment ID:', paymentId)
        return new Response(
          JSON.stringify({ success: true, message: 'Transaction not found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Transaction found:', transaction.id, 'Company:', transaction.company_id)

      // Buscar configurações do Mercado Pago da empresa
      const { data: settings, error: settingsError } = await supabase
        .from('mercadopago_settings')
        .select('access_token_encrypted, is_sandbox, company_id')
        .eq('company_id', transaction.company_id)
        .single()

      console.log('Settings search result:', settings ? 'Found' : 'Not found', settingsError)

      if (!settings) {
        console.error('MercadoPago settings not found for company:', transaction.company_id)
        return new Response(
          JSON.stringify({ success: true, message: 'Settings not found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Descriptografar token
      const { data: accessToken, error: decryptError } = await supabase.rpc('decrypt_mercadopago_credential', {
        p_company_id: transaction.company_id,
        p_encrypted_credential: settings.access_token_encrypted
      })

      console.log('Decryption result:', accessToken ? 'Success' : 'Failed', decryptError)

      if (!accessToken || decryptError) {
        console.error('Failed to decrypt access token:', decryptError)
        return new Response(
          JSON.stringify({ success: true, message: 'Failed to decrypt token' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Buscar detalhes do pagamento na API do Mercado Pago
      const baseUrl = 'https://api.mercadopago.com'
      const mpResponse = await fetch(`${baseUrl}/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!mpResponse.ok) {
        console.error('Failed to fetch payment from MercadoPago API:', mpResponse.status)
        return new Response(
          JSON.stringify({ success: true, message: 'Failed to fetch payment details' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const paymentData = await mpResponse.json()
      console.log('Payment data from API - Status:', paymentData.status, 'Status Detail:', paymentData.status_detail)

      // Atualizar status da transação
      let newStatus = transaction.status // Manter status atual por padrão
      let paidAt = null
      let statusPreserved = false

      // IMPORTANTE: Se já está pago, NÃO permite regredir para outro status (exceto refund)
      const isPaid = transaction.status === 'paid'

      switch (paymentData.status) {
        case 'approved':
          newStatus = 'paid'
          paidAt = paymentData.date_approved || new Date().toISOString()
          console.log('Payment approved, updating to paid')
          break
        case 'rejected':
        case 'cancelled':
          // Só marca como cancelled se NÃO estiver pago
          if (!isPaid) {
            newStatus = 'cancelled'
            console.log('Payment rejected/cancelled')
          } else {
            console.log(`⚠️ Ignorando cancelled/rejected - pagamento ${transaction.id} já está pago. Status preservado.`)
            statusPreserved = true
          }
          break
        case 'refunded':
          // Refund pode sobrescrever paid (é uma reversão legítima)
          newStatus = 'refunded'
          console.log('Payment refunded')
          break
        case 'in_process':
        case 'pending':
          // Só muda para pending se não estiver pago
          if (!isPaid) {
            newStatus = 'pending'
            console.log('Payment in process/pending')
          } else {
            console.log(`⚠️ Ignorando pending/in_process - pagamento ${transaction.id} já está pago. Status preservado.`)
            statusPreserved = true
          }
          break
        default:
          console.log('Unknown payment status:', paymentData.status)
      }

      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }

      if (paidAt) {
        updateData.paid_at = paidAt
      }

      const { error: updateError } = await supabase
        .from('payment_transactions')
        .update(updateData)
        .eq('id', transaction.id)

      if (updateError) {
        console.error('Failed to update transaction:', updateError)
      } else {
        console.log('Transaction updated successfully:', transaction.id, 'New status:', newStatus)
      }

      // Log do webhook
      await supabase.from('mercadopago_logs').insert({
        company_id: transaction.company_id,
        operation_type: 'webhook',
        status: updateError ? 'error' : 'success',
        request_data: body,
        response_data: { ...paymentData, status_preserved: statusPreserved }
      })
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