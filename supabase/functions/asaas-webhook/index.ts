import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookData = await req.json();
    console.log('Received Asaas webhook:', JSON.stringify(webhookData, null, 2));

    const { event, payment } = webhookData;

    if (!payment || !payment.id) {
      throw new Error('Invalid webhook data: missing payment information');
    }

    // Find the payment transaction by external_id (Asaas payment ID)
    const { data: transaction, error: findError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('external_id', payment.id)
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
      company_id: transaction.company_id,
      operation_type: 'webhook',
      status: 'success',
      request_data: webhookData,
      response_data: { payment_id: transaction.id, new_status: newStatus }
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
        error_message: error.message,
        request_data: await req.json().catch(() => ({}))
      });
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
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