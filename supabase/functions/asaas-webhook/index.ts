import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token, accessToken, x-access-token',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Variáveis para reuso (evitar ler o body mais de uma vez)
    let webhookData: any = null;
    let authorizedCompanyId: string | null = null;
    // Verificar assinatura do webhook
    // Extração flexível do token (Asaas envia 'asaas-access-token'; também aceitamos variações e querystring)
    const getBearer = (h: string | null) =>
      h && h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : null;

    const url = new URL(req.url);
    const headerToken =
      req.headers.get('asaas-access-token') ||
      req.headers.get('accessToken') ||
      req.headers.get('x-access-token') ||
      getBearer(req.headers.get('authorization'));

    const queryToken =
      url.searchParams.get('asaas-access-token') ||
      url.searchParams.get('accessToken') ||
      url.searchParams.get('asaas_access_token');

    const authToken = headerToken || queryToken;

    if (!authToken) {
      // Sem token: tentar autorizar pelo paymentId para contas que não configuraram token
      try {
        webhookData = await req.json();
        const paymentId = webhookData?.payment?.id;
        if (paymentId) {
          const { data: tx } = await supabase
            .from('payment_transactions')
            .select('company_id')
            .eq('external_id', paymentId)
            .single();
          if (tx?.company_id) {
            const { data: s } = await supabase
              .from('asaas_settings')
              .select('company_id, webhook_auth_token, webhook_enabled')
              .eq('company_id', tx.company_id)
              .eq('webhook_enabled', true)
              .maybeSingle();
            if (s && !s.webhook_auth_token) {
              authorizedCompanyId = tx.company_id;
            }
          }
        }
      } catch (_) {}

      if (!authorizedCompanyId) {
        console.error('Webhook sem token e sem autorização por fallback');
        return new Response(
          JSON.stringify({ error: 'Token ausente. Configure o AccessToken no Asaas ou use ?accessToken=TOKEN' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!webhookData) {
      webhookData = await req.json();
    }
    console.log('Received Asaas webhook:', JSON.stringify(webhookData, null, 2));

    const { event, payment } = webhookData;

    if (!payment || !payment.id) {
      throw new Error('Invalid webhook data: missing payment information');
    }

    // Resolver company pelo token (ou fallback sem token)
    let webhookSettings: any = null;
    if (authToken) {
      const { data } = await supabase
        .from('asaas_settings')
        .select('webhook_auth_token, company_id')
        .eq('webhook_auth_token', authToken)
        .eq('webhook_enabled', true)
        .single();
      webhookSettings = data;
    } else if (authorizedCompanyId) {
      webhookSettings = { company_id: authorizedCompanyId };
    }

    if (!webhookSettings) {
      // Fallback: empresa sem token configurado ou token divergente, autorizar via payment.id
      try {
        if (!webhookData) {
          webhookData = await req.json();
        }
      } catch(_) {}
      const paymentId = webhookData?.payment?.id;
      if (paymentId) {
        const { data: tx } = await supabase
          .from('payment_transactions')
          .select('company_id')
          .eq('external_id', paymentId)
          .single();
        if (tx?.company_id) {
          const { data: s } = await supabase
            .from('asaas_settings')
            .select('company_id, webhook_auth_token, webhook_enabled')
            .eq('company_id', tx.company_id)
            .eq('webhook_enabled', true)
            .maybeSingle();
          if (s && (!s.webhook_auth_token || s.webhook_auth_token === authToken)) {
            webhookSettings = { company_id: tx.company_id };
          }
        }
      }

      if (!webhookSettings) {
        console.error('Token de webhook inválido:', authToken);
        return new Response(
          JSON.stringify({ error: 'Token de webhook inválido' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Find the payment transaction by external_id (Asaas payment ID)
    const { data: transaction, error: findError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('external_id', payment.id)
      .eq('company_id', webhookSettings.company_id)
      .single();

    if (findError) {
      console.error('Payment not found for external_id:', payment.id);
      // Return 200 to avoid webhook retries for unknown payments
      return new Response(
        JSON.stringify({ message: 'Payment not found, ignoring webhook' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let newStatus = transaction.status;
    let paidAt = transaction.paid_at;

    // Map Asaas payment status to our status
    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        newStatus = 'paid';
        paidAt = new Date().toISOString();
        break;
      
      case 'PAYMENT_OVERDUE':
        newStatus = 'overdue';
        break;
      
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
        newStatus = 'cancelled';
        break;
      
      case 'PAYMENT_CREATED':
      case 'PAYMENT_AWAITING_PAYMENT':
        newStatus = 'pending';
        break;
    }

    // Update payment status if changed
    if (newStatus !== transaction.status) {
      const { error: updateError } = await supabase
        .from('payment_transactions')
        .update({
          status: newStatus,
          paid_at: paidAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.id);

      if (updateError) {
        console.error('Error updating payment status:', updateError);
        throw updateError;
      }

      console.log(`Updated payment ${transaction.id} status from ${transaction.status} to ${newStatus}`);

      // If payment was confirmed, check if company should be unblocked
      if (newStatus === 'paid') {
        await handlePaymentConfirmation(transaction);
      }
      
      // If payment is overdue, check if company should be blocked
      if (newStatus === 'overdue') {
        await handlePaymentOverdue(transaction);
      }
    }

    // Log webhook event
    await supabase.from('asaas_logs').insert({
      company_id: webhookSettings.company_id,
      operation_type: 'webhook',
      status: 'success',
      request_data: webhookData,
      response_data: { payment_id: transaction.id, new_status: newStatus, event }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processed successfully',
        payment_id: transaction.id,
        new_status: newStatus
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing Asaas webhook:', error);
    
    // Log error
    try {
      await supabase.from('asaas_logs').insert({
        company_id: null,
        operation_type: 'webhook',
        status: 'error',
        error_message: error instanceof Error ? error.message : String(error),
        request_data: await req.json().catch(() => ({}))
      });
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function handlePaymentConfirmation(transaction: any) {
  try {
    // Check if this clears all overdue payments for the company
    const { data: overduePayments } = await supabase
      .from('payment_transactions')
      .select('id')
      .eq('company_id', transaction.company_id)
      .eq('status', 'overdue');

    if (!overduePayments || overduePayments.length === 0) {
      // No overdue payments, ensure company is active
      await supabase
        .from('companies')
        .update({ is_active: true })
        .eq('id', transaction.company_id);

      console.log(`Company ${transaction.company_id} reactivated - all payments up to date`);
    }
  } catch (error) {
    console.error('Error handling payment confirmation:', error);
  }
}

async function handlePaymentOverdue(transaction: any) {
  try {
    // Check company's payment history and overdue policy
    const { data: overduePayments } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('company_id', transaction.company_id)
      .eq('status', 'overdue')
      .order('due_date', { ascending: true });

    if (overduePayments && overduePayments.length > 0) {
      const oldestOverdue = overduePayments[0];
      const daysSinceOverdue = Math.floor(
        (Date.now() - new Date(oldestOverdue.due_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Block company if overdue for more than 15 days
      if (daysSinceOverdue > 15) {
        await supabase
          .from('companies')
          .update({ is_active: false })
          .eq('id', transaction.company_id);

        console.log(`Company ${transaction.company_id} blocked - overdue for ${daysSinceOverdue} days`);
      }
    }
  } catch (error) {
    console.error('Error handling payment overdue:', error);
  }
}