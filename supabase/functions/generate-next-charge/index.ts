import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calcular próxima data de vencimento (+1 mês, mantendo o dia)
function calculateNextDueDate(currentDueDate: string): string {
  const date = new Date(currentDueDate + 'T12:00:00Z');
  const originalDay = date.getUTCDate();
  
  // Avançar 1 mês
  date.setUTCMonth(date.getUTCMonth() + 1);
  
  // Se o dia "caiu" (ex: 31 Jan → 28 Fev), ajustar para último dia do mês
  if (date.getUTCDate() !== originalDay) {
    date.setUTCDate(0); // Último dia do mês anterior
  }
  
  return date.toISOString().split('T')[0];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id } = await req.json();
    
    console.log('🔄 Generate next charge triggered for payment:', payment_id);

    if (!payment_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'payment_id é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar pagamento com dados do contrato
    const { data: payment, error: paymentError } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        contracts(id, status, monthly_value, end_date)
      `)
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      console.error('❌ Payment not found:', paymentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Pagamento não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se tem contrato vinculado
    if (!payment.contract_id) {
      console.log('ℹ️ Payment has no contract_id, skipping next charge generation');
      return new Response(
        JSON.stringify({ 
          success: true, 
          created: false, 
          message: 'Cobrança avulsa, não gera próxima' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contract = payment.contracts;

    // Verificar se contrato está ativo
    if (!contract || contract.status !== 'active') {
      console.log('ℹ️ Contract is not active, skipping next charge generation');
      return new Response(
        JSON.stringify({ 
          success: true, 
          created: false, 
          message: 'Contrato não está ativo' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se pagamento tem due_date
    if (!payment.due_date) {
      console.log('ℹ️ Payment has no due_date, skipping');
      return new Response(
        JSON.stringify({ 
          success: true, 
          created: false, 
          message: 'Pagamento sem data de vencimento' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calcular próxima data de vencimento
    const nextDueDate = calculateNextDueDate(payment.due_date);
    console.log('📅 Next due date calculated:', nextDueDate);

    // Verificar se contrato tem data de fim e se a próxima cobrança ultrapassaria
    if (contract.end_date && nextDueDate > contract.end_date) {
      console.log('ℹ️ Next charge would exceed contract end date, skipping');
      return new Response(
        JSON.stringify({ 
          success: true, 
          created: false, 
          message: 'Próxima cobrança ultrapassaria fim do contrato' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calcular intervalo do próximo mês para verificar duplicatas
    const nextDueDateObj = new Date(nextDueDate + 'T12:00:00Z');
    const monthStart = new Date(nextDueDateObj.getUTCFullYear(), nextDueDateObj.getUTCMonth(), 1);
    const monthEnd = new Date(nextDueDateObj.getUTCFullYear(), nextDueDateObj.getUTCMonth() + 1, 0);
    
    const monthStartStr = monthStart.toISOString().split('T')[0];
    const monthEndStr = monthEnd.toISOString().split('T')[0];

    console.log('🔍 Checking for existing charges between:', monthStartStr, 'and', monthEndStr);

    // Verificar se já existe cobrança para o próximo mês
    const { data: existingCharges, error: existingError } = await supabase
      .from('payment_transactions')
      .select('id, due_date, status')
      .eq('client_id', payment.client_id)
      .eq('contract_id', payment.contract_id)
      .in('status', ['pending', 'overdue', 'paid'])
      .gte('due_date', monthStartStr)
      .lte('due_date', monthEndStr);

    if (existingError) {
      console.error('❌ Error checking existing charges:', existingError);
      throw existingError;
    }

    if (existingCharges && existingCharges.length > 0) {
      console.log('ℹ️ Charge already exists for next month:', existingCharges[0].id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          created: false, 
          message: 'Já existe cobrança para o próximo mês',
          existing_payment_id: existingCharges[0].id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar o valor da cobrança (prioriza monthly_value do contrato)
    const chargeAmount = contract.monthly_value || payment.amount;

    // Criar nova cobrança
    const newPaymentData = {
      company_id: payment.company_id,
      client_id: payment.client_id,
      contract_id: payment.contract_id,
      amount: chargeAmount,
      due_date: nextDueDate,
      status: 'pending',
      transaction_type: payment.transaction_type || 'monthly',
      description: payment.description || `Mensalidade - ${nextDueDate.substring(0, 7)}`,
      payment_gateway: null,
      external_id: null,
      pix_code: null,
      barcode: null,
      payment_url: null, // Será preenchido após criação com o ID
    };

    console.log('📝 Creating new charge:', newPaymentData);

    const { data: newPayment, error: insertError } = await supabase
      .from('payment_transactions')
      .insert(newPaymentData)
      .select('id')
      .single();

    if (insertError || !newPayment) {
      console.error('❌ Error creating new charge:', insertError);
      throw insertError;
    }

    // Buscar domínio customizado da empresa
    const { data: company } = await supabase
      .from('companies')
      .select('domain')
      .eq('id', payment.company_id)
      .single();

    // Sanitizar domínio e APP_URL e construir URL correta (evitar barra dupla)
    const appUrl = (Deno.env.get('APP_URL') || 'https://appliratracker.lovable.app').replace(/\/+$/, '');
    const sanitizedDomain = company?.domain 
      ? company.domain.replace(/^https?:\/+/i, '').replace(/\/+$/, '')
      : null;
    const baseUrl = sanitizedDomain ? `https://${sanitizedDomain}` : appUrl;
    const checkoutUrl = `${baseUrl}/checkout/${newPayment.id}`;
    
    await supabase
      .from('payment_transactions')
      .update({ payment_url: checkoutUrl })
      .eq('id', newPayment.id);

    console.log('✅ Next charge created successfully:', newPayment.id);
    console.log('🔗 Checkout URL:', checkoutUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        created: true,
        new_payment_id: newPayment.id,
        due_date: nextDueDate,
        amount: chargeAmount,
        checkout_url: checkoutUrl,
        message: 'Próxima cobrança gerada com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in generate-next-charge:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
