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
    console.log('=== PROCESS-CHECKOUT STARTED ===');
    const requestData = await req.json();
    console.log('Request body:', JSON.stringify(requestData, null, 2));
    
    // Validate input data
    const payment_id = requestData.payment_id?.trim();
    const payment_method = requestData.payment_method?.trim();
    const client_data = requestData.client_data;

    console.log('Processing checkout:', { payment_id, payment_method, has_client_data: !!client_data });

    // Validate required fields
    if (!payment_id || typeof payment_id !== 'string' || payment_id.length === 0) {
      throw new Error('payment_id inválido');
    }

    if (!payment_method || typeof payment_method !== 'string' || payment_method.length === 0) {
      throw new Error('payment_method inválido');
    }

    // Validate payment_method against allowed values
    const allowedMethods = ['pix', 'boleto', 'credit_card', 'debit_card'];
    if (!allowedMethods.includes(payment_method)) {
      throw new Error('Método de pagamento inválido');
    }

    // Buscar dados do pagamento
    console.log('Fetching payment data for ID:', payment_id);
    const { data: payment, error: paymentError } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        clients!inner(name, email, phone, document),
        companies!inner(name, encryption_key)
      `)
      .eq('id', payment_id)
      .single();

    if (paymentError) {
      console.error('Payment fetch error:', paymentError);
      throw new Error(`Erro ao buscar pagamento: ${paymentError.message}`);
    }

    if (!payment) {
      console.error('Payment not found');
      throw new Error('Pagamento não encontrado');
    }

    console.log('Payment found:', { 
      id: payment.id, 
      status: payment.status, 
      company_id: payment.company_id 
    });

    // Verificar se já foi pago
    if (payment.status === 'paid') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Pagamento já realizado' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar qual gateway usar baseado na configuração
    console.log('Looking for gateway config:', { 
      company_id: payment.company_id, 
      payment_method 
    });
    
    const { data: gatewayConfig, error: configError } = await supabase
      .from('payment_gateway_methods')
      .select('gateway_type, priority')
      .eq('company_id', payment.company_id)
      .eq('payment_method', payment_method)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1)
      .single();

    if (configError) {
      console.error('Gateway config error:', configError);
      throw new Error(`Erro ao buscar configuração do gateway: ${configError.message}`);
    }

    if (!gatewayConfig) {
      console.error('No gateway config found');
      throw new Error('Gateway não configurado para este método de pagamento');
    }

    const gateway = gatewayConfig.gateway_type;
    console.log(`Using gateway: ${gateway} for method: ${payment_method}`);

    // Preparar dados do cliente
    const clientData = {
      name: payment.clients.name || client_data?.name,
      email: payment.clients.email || client_data?.email,
      phone: payment.clients.phone || client_data?.phone,
      document: payment.clients.document || client_data?.document
    };

    // Criar cobrança no gateway selecionado
    const billingType = getBillingType(payment_method);
    
    const chargeData = {
      action: 'create_charge',
      company_id: payment.company_id,
      data: {
        billingType: billingType,
        value: payment.amount,
        dueDate: payment.due_date,
        description: `Pagamento - ${payment.companies.name}`,
        externalReference: payment.id,
        customer: clientData
      }
    };

    console.log('Creating charge in gateway:', gateway);

    const { data: gatewayResponse, error: gatewayError } = await supabase.functions.invoke(
      `${gateway}-integration`,
      { body: chargeData }
    );

    if (gatewayError) {
      console.error('Gateway error:', gatewayError);
      throw new Error(`Erro ao processar pagamento: ${gatewayError.message}`);
    }

    if (!gatewayResponse?.success) {
      console.error('Gateway response error:', gatewayResponse);
      throw new Error(gatewayResponse?.error || 'Erro ao gerar cobrança no gateway');
    }

    const charge = gatewayResponse.charge;

    // Atualizar transaction com dados do gateway
    await supabase
      .from('payment_transactions')
      .update({
        external_id: charge.id,
        payment_url: charge.invoiceUrl || charge.invoice_url,
        barcode: charge.bankSlipUrl || charge.bankslip_url,
        pix_code: charge.pixCode || charge.pix_code || charge.pixQrCodeId,
        payment_gateway: gateway,
        transaction_type: payment_method,
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    console.log('Checkout processed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: charge.invoiceUrl || charge.invoice_url,
        pix_code: charge.pixCode || charge.pix_code,
        barcode: charge.bankSlipUrl || charge.bankslip_url,
        external_id: charge.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing checkout:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function getBillingType(paymentMethod: string): string {
  const mappings: Record<string, string> = {
    'pix': 'PIX',
    'boleto': 'BOLETO',
    'credit_card': 'CREDIT_CARD',
    'debit_card': 'DEBIT_CARD',
  };

  return mappings[paymentMethod] || 'BOLETO';
}
