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
    let webhookData: any;
    
    const contentType = req.headers.get('content-type') || '';
    console.log('=== ASAAS WEBHOOK RECEBIDO ===');
    console.log('Content-Type:', contentType);
    
    // Verificar o formato dos dados recebidos
    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Asaas envia como form-urlencoded
      const text = await req.text();
      console.log('Form-urlencoded data recebido:', text.substring(0, 300));
      
      const params = new URLSearchParams(text);
      const dataParam = params.get('data');
      
      if (dataParam) {
        webhookData = JSON.parse(dataParam);
        console.log('JSON extraído do parâmetro data');
      } else {
        // Tentar parsear todos os parâmetros como objeto
        webhookData = Object.fromEntries(params.entries());
        console.log('Dados parseados de form entries');
      }
    } else {
      // Formato JSON padrão
      webhookData = await req.json();
      console.log('JSON recebido diretamente');
    }
    
    console.log('Webhook parseado:', JSON.stringify(webhookData, null, 2));

    const { event, payment } = webhookData;

    if (!payment || !payment.id) {
      console.log('Invalid webhook data: missing payment information');
      // Sempre retornar 200 para evitar que o Asaas pause a fila
      return new Response(
        JSON.stringify({ success: true, message: 'Invalid webhook data' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar a transação de pagamento pelo external_id (Asaas payment ID) ou externalReference (nosso UUID)
    const paymentId = payment.id;
    const externalReference = payment.externalReference;
    
    console.log('Buscando transação:', { paymentId, externalReference });

    let transaction: any = null;
    
    // Tentar buscar pelo external_id primeiro
    const { data: txByExternal } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('external_id', paymentId)
      .maybeSingle();
      
    if (txByExternal) {
      transaction = txByExternal;
      console.log('Transação encontrada pelo external_id:', transaction.id);
    } 
    // Se não encontrou, tentar pelo externalReference (nosso UUID)
    else if (externalReference) {
      const { data: txByRef } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('id', externalReference)
        .maybeSingle();
        
      if (txByRef) {
        transaction = txByRef;
        console.log('Transação encontrada pelo externalReference:', transaction.id);
        
        // Atualizar o external_id se estava vazio
        if (!txByRef.external_id) {
          await supabase
            .from('payment_transactions')
            .update({ external_id: payment.id })
            .eq('id', txByRef.id);
            
          console.log(`Updated external_id for payment ${txByRef.id}`);
        }
      }
    }

    if (!transaction) {
      console.log('Transação não encontrada no sistema - ignorando webhook');
      // Sempre retornar 200 para evitar que o Asaas pause a fila
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Transaction not found, webhook ignored' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyId = transaction.company_id;

    let newStatus = transaction.status;
    let paidAt = transaction.paid_at;
    let statusPreserved = false;
    let cancellationReason: string | null = null;

    // IMPORTANTE: Se já está pago, NÃO permite regredir para outro status
    // Isso evita que webhooks de cobranças duplicadas (boleto vs PIX) sobrescrevam
    const isPaid = transaction.status === 'paid';

    // Map Asaas payment status to our status
    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        newStatus = 'paid';
        paidAt = new Date().toISOString();
        break;
      
      case 'PAYMENT_OVERDUE':
        // Só marca como overdue se NÃO estiver pago
        if (!isPaid) {
          newStatus = 'overdue';
          // Pagamento vencido indica expiração
          cancellationReason = 'expired';
        } else {
          console.log(`Ignorando PAYMENT_OVERDUE - pagamento ${transaction.id} já está pago`);
          statusPreserved = true;
        }
        break;
      
      case 'PAYMENT_DELETED':
        // Deletado = cancelamento manual ou pelo sistema
        newStatus = 'cancelled';
        cancellationReason = 'manual';
        break;
        
      case 'PAYMENT_REFUNDED':
        newStatus = 'cancelled';
        cancellationReason = 'gateway';
        break;
      
      case 'PAYMENT_CREATED':
      case 'PAYMENT_AWAITING_PAYMENT':
        // Só muda para pending se não estiver pago
        if (!isPaid) {
          newStatus = 'pending';
        } else {
          statusPreserved = true;
        }
        break;
    }

    // Update payment status if changed
    if (newStatus !== transaction.status) {
      const updateData: any = {
        status: newStatus,
        paid_at: paidAt,
        updated_at: new Date().toISOString()
      };
      
      // Adicionar motivo de cancelamento se aplicável
      if (cancellationReason) {
        updateData.cancellation_reason = cancellationReason;
      } else if (newStatus === 'paid' || newStatus === 'pending') {
        // Limpar motivo de cancelamento se pagamento foi recuperado
        updateData.cancellation_reason = null;
      }
      
      const { error: updateError } = await supabase
        .from('payment_transactions')
        .update(updateData)
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
      company_id: companyId,
      operation_type: 'webhook',
      status: 'success',
      request_data: webhookData,
      response_data: { 
        payment_id: transaction.id, 
        new_status: newStatus, 
        event,
        status_preserved: statusPreserved 
      }
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
        request_data: {}
      });
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }

    // SEMPRE retornar 200 para evitar que o Asaas pause a fila
    // Apenas logamos o erro internamente
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Webhook received but encountered error during processing' 
      }),
      { 
        status: 200, 
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