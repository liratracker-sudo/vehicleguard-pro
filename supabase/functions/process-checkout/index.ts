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

interface LateFeeSettings {
  is_active: boolean;
  fine_enabled: boolean;
  fine_type: string;
  fine_value: number;
  interest_enabled: boolean;
  interest_type: string;
  interest_value: number;
  grace_days: number;
}

interface LateFeeCalculation {
  originalAmount: number;
  fineAmount: number;
  interestAmount: number;
  totalAmount: number;
  daysOverdue: number;
  isOverdue: boolean;
}

function calculateLateFees(
  amount: number,
  dueDate: string,
  settings: LateFeeSettings | null
): LateFeeCalculation {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - due.getTime();
  const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  const result: LateFeeCalculation = {
    originalAmount: amount,
    fineAmount: 0,
    interestAmount: 0,
    totalAmount: amount,
    daysOverdue: Math.max(0, daysOverdue),
    isOverdue: daysOverdue > 0
  };
  
  // Se não está vencido ou não tem configuração ativa, retornar sem multa
  if (!result.isOverdue || !settings?.is_active) {
    return result;
  }
  
  const effectiveDaysOverdue = Math.max(0, daysOverdue - (settings.grace_days || 0));
  
  // Calcular multa (aplicada uma vez após período de carência)
  if (settings.fine_enabled && effectiveDaysOverdue > 0) {
    if (settings.fine_type === 'PERCENTAGE') {
      result.fineAmount = amount * (settings.fine_value / 100);
    } else {
      result.fineAmount = settings.fine_value;
    }
  }
  
  // Calcular juros (por dia de atraso após carência)
  if (settings.interest_enabled && effectiveDaysOverdue > 0) {
    if (settings.interest_type === 'PERCENTAGE') {
      result.interestAmount = amount * (settings.interest_value / 100) * effectiveDaysOverdue;
    } else {
      result.interestAmount = settings.interest_value * effectiveDaysOverdue;
    }
  }
  
  // Arredondar para 2 casas decimais
  result.fineAmount = Math.round(result.fineAmount * 100) / 100;
  result.interestAmount = Math.round(result.interestAmount * 100) / 100;
  result.totalAmount = Math.round((amount + result.fineAmount + result.interestAmount) * 100) / 100;
  
  return result;
}

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
      company_id: payment.company_id,
      amount: payment.amount,
      contract_id: payment.contract_id
    });

    // Buscar valor correto do contrato se existir (para garantir consistência)
    let baseAmount = payment.amount;
    if (payment.contract_id) {
      const { data: contract } = await supabase
        .from('contracts')
        .select('monthly_value')
        .eq('id', payment.contract_id)
        .single();
      
      if (contract?.monthly_value && contract.monthly_value !== payment.amount) {
        console.log(`⚠️ Valor do pagamento (${payment.amount}) diferente do contrato (${contract.monthly_value}). Usando valor do contrato.`);
        baseAmount = contract.monthly_value;
      }
    }
    console.log('Base amount for fee calculation:', baseAmount);

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

    // Verificar se foi cancelado
    if (payment.status === 'cancelled') {
      // Verificar se pode regenerar (expirado ou tem external_id indicando processamento anterior)
      const canRegenerate = payment.cancellation_reason === 'expired' || 
                            (payment.external_id && payment.cancellation_reason !== 'manual');
      
      if (!canRegenerate) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Pagamento cancelado manualmente. Solicite uma nova cobrança.' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('🔄 Regenerating expired payment:', payment.id);
    }

    // Buscar configurações de multa/juros
    console.log('Fetching late fee settings for company:', payment.company_id);
    const { data: feeSettings } = await supabase
      .from('company_late_fee_settings')
      .select('*')
      .eq('company_id', payment.company_id)
      .maybeSingle();

    console.log('Late fee settings:', feeSettings);

    // Calcular multa e juros se aplicável (usando baseAmount do contrato)
    const feeCalculation = calculateLateFees(
      baseAmount,
      payment.due_date,
      feeSettings
    );

    console.log('Fee calculation:', feeCalculation);

    // ======= VALIDAÇÃO DE REGRAS DE GATEWAY =======
    const chargeValue = feeCalculation.totalAmount;
    console.log('Checking gateway rules for amount:', chargeValue);

    const { data: gatewayRules } = await supabase
      .from('payment_gateway_rules')
      .select('*')
      .eq('company_id', payment.company_id)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    // Filtrar regras aplicáveis ao valor
    const applicableRules = (gatewayRules || []).filter(rule => {
      const minOk = rule.min_amount === null || chargeValue >= rule.min_amount;
      const maxOk = rule.max_amount === null || chargeValue <= rule.max_amount;
      return minOk && maxOk;
    });

    const activeRule = applicableRules.length > 0 ? applicableRules[0] : null;

    if (activeRule) {
      console.log('Active gateway rule found:', {
        name: activeRule.name,
        min_amount: activeRule.min_amount,
        max_amount: activeRule.max_amount,
        allowed_gateways: activeRule.allowed_gateways,
        allowed_methods: activeRule.allowed_methods
      });
      
      // Validar método de pagamento
      if (activeRule.allowed_methods && activeRule.allowed_methods.length > 0) {
        if (!activeRule.allowed_methods.includes(payment_method)) {
          const methodLabels: Record<string, string> = {
            'pix': 'PIX',
            'boleto': 'Boleto',
            'credit_card': 'Cartão de Crédito',
            'debit_card': 'Cartão de Débito'
          };
          const allowedLabels = activeRule.allowed_methods.map((m: string) => methodLabels[m] || m).join(', ');
          throw new Error(`Para valores entre R$${activeRule.min_amount || 0} e R$${activeRule.max_amount || '∞'}, apenas os seguintes métodos são permitidos: ${allowedLabels}`);
        }
      }
    } else {
      console.log('No gateway rules found for this amount');
    }
    // ======= FIM VALIDAÇÃO DE REGRAS =======

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

    // Validar gateway contra regra ativa
    if (activeRule && activeRule.allowed_gateways && activeRule.allowed_gateways.length > 0) {
      if (!activeRule.allowed_gateways.includes(gateway)) {
        const gatewayLabels: Record<string, string> = {
          'asaas': 'Asaas',
          'mercadopago': 'Mercado Pago',
          'inter': 'Inter',
          'gerencianet': 'Gerencianet'
        };
        const allowedLabels = activeRule.allowed_gateways.map((g: string) => gatewayLabels[g] || g).join(', ');
        throw new Error(`Para este valor, apenas os seguintes gateways são permitidos: ${allowedLabels}. Por favor, escolha outro método de pagamento.`);
      }
    }

    // Preparar dados do cliente
    const clientData = {
      name: payment.clients.name || client_data?.name,
      email: payment.clients.email || client_data?.email,
      phone: payment.clients.phone || client_data?.phone,
      document: payment.clients.document || client_data?.document
    };

    console.log('Client data:', JSON.stringify(clientData, null, 2));

    const billingType = getBillingType(payment_method);
    let chargeData: any;

    // Para Asaas, precisamos criar cliente primeiro e usar customerId
    if (gateway === 'asaas') {
      console.log('Creating customer in Asaas first...');
      const { data: customerResponse, error: customerError } = await supabase.functions.invoke(
        'asaas-integration',
        { 
          body: {
            action: 'create_customer',
            company_id: payment.company_id,
            data: clientData
          }
        }
      );

      console.log('Customer response:', JSON.stringify(customerResponse, null, 2));

      if (customerError || !customerResponse?.success) {
        console.error('Customer creation error:', customerError || customerResponse);
        throw new Error(`Erro ao criar cliente: ${customerError?.message || customerResponse?.error || 'Erro desconhecido'}`);
      }

      const customerId = customerResponse.customer?.id;
      if (!customerId) {
        throw new Error('ID do cliente não retornado pelo Asaas');
      }

      console.log('Customer created with ID:', customerId);

      // FIX: Para pagamentos vencidos, usar data de hoje (Asaas não aceita datas passadas)
      const todayStr = new Date().toISOString().split('T')[0];
      const effectiveDueDate = feeCalculation.isOverdue ? todayStr : payment.due_date;
      
      console.log('📅 Due date calculation:', {
        original_due_date: payment.due_date,
        is_overdue: feeCalculation.isOverdue,
        effective_due_date: effectiveDueDate
      });

      // Preparar dados da cobrança com multa/juros nativos do Asaas (para cobranças futuras)
      const asaasChargeData: any = {
        customerId: customerId,
        billingType: billingType,
        value: chargeValue,
        dueDate: effectiveDueDate,
        description: `Pagamento - ${payment.companies.name}`,
        externalReference: payment.id
      };

      // Se a cobrança está vencida e tem multa, adicionar na descrição
      if (feeCalculation.isOverdue && feeCalculation.fineAmount > 0) {
        asaasChargeData.description = `Pagamento - ${payment.companies.name} (inclui multa/juros por atraso)`;
      }

      chargeData = {
        action: 'create_charge',
        company_id: payment.company_id,
        data: asaasChargeData
      };
    } else {
      // FIX: Para pagamentos vencidos, usar data de hoje
      const todayStr = new Date().toISOString().split('T')[0];
      const effectiveDueDate = feeCalculation.isOverdue ? todayStr : payment.due_date;
      
      console.log('📅 Due date calculation (non-Asaas):', {
        original_due_date: payment.due_date,
        is_overdue: feeCalculation.isOverdue,
        effective_due_date: effectiveDueDate
      });

      // Para outros gateways (MercadoPago, Inter, Gerencianet), passar dados do cliente diretamente
      chargeData = {
        action: 'create_charge',
        company_id: payment.company_id,
        data: {
          billingType: billingType,
          value: chargeValue,
          dueDate: effectiveDueDate,
          description: feeCalculation.isOverdue && feeCalculation.fineAmount > 0
            ? `Pagamento - ${payment.companies.name} (inclui multa/juros por atraso)`
            : `Pagamento - ${payment.companies.name}`,
          externalReference: payment.id,
          customer: clientData
        }
      };
    }

    console.log('Creating charge in gateway:', gateway);
    console.log('Charge data:', JSON.stringify(chargeData, null, 2));

    const { data: gatewayResponse, error: gatewayError } = await supabase.functions.invoke(
      `${gateway}-integration`,
      { body: chargeData }
    );

    console.log('Gateway response:', JSON.stringify(gatewayResponse, null, 2));
    console.log('Gateway error:', gatewayError);

    if (gatewayError) {
      console.error('Gateway error:', gatewayError);
      throw new Error(`Erro ao processar pagamento: ${gatewayError.message}`);
    }

    if (!gatewayResponse?.success) {
      console.error('Gateway response error:', gatewayResponse);
      throw new Error(gatewayResponse?.error || 'Erro ao gerar cobrança no gateway');
    }

    const charge = gatewayResponse.charge;
    
    console.log('=== CHARGE DATA BEFORE UPDATE ===');
    console.log('charge.id:', charge.id);
    console.log('charge.pix_code:', charge.pix_code);
    console.log('charge.pixCode:', charge.pixCode);
    console.log('charge.qr_code:', charge.qr_code);
    console.log('charge.invoice_url:', charge.invoice_url);
    console.log('charge.invoiceUrl:', charge.invoiceUrl);
    console.log('=================================');

    const updateData: any = {
      external_id: charge.id?.toString(),
      payment_url: charge.invoiceUrl || charge.invoice_url || charge.ticket_url,
      barcode: charge.bankSlipUrl || charge.bankslip_url,
      pix_code: charge.pix_code || charge.pixCode || charge.pixQrCodeId || charge.qr_code,
      payment_gateway: gateway,
      transaction_type: payment_method,
      status: 'pending',  // Resetar para pending (importante para pagamentos expirados regenerados)
      cancellation_reason: null,  // Limpar motivo de cancelamento
      updated_at: new Date().toISOString()
    };

    // Adicionar campos de multa/juros se aplicável
    if (feeCalculation.isOverdue) {
      updateData.original_amount = feeCalculation.originalAmount;
      updateData.fine_amount = feeCalculation.fineAmount;
      updateData.interest_amount = feeCalculation.interestAmount;
      updateData.days_overdue = feeCalculation.daysOverdue;
      updateData.amount = feeCalculation.totalAmount;
    }
    
    console.log('=== UPDATE DATA ===');
    console.log(JSON.stringify(updateData, null, 2));
    console.log('==================');

    // Atualizar transaction com dados do gateway
    const { error: updateError } = await supabase
      .from('payment_transactions')
      .update(updateData)
      .eq('id', payment.id);
      
    if (updateError) {
      console.error('Update error:', updateError);
    }

    console.log('Checkout processed successfully');

    const responseData = {
      success: true,
      payment_url: charge.invoiceUrl || charge.invoice_url || charge.ticket_url,
      pix_code: charge.pix_code || charge.pixCode || charge.pixQrCodeId || charge.qr_code,
      barcode: charge.bankSlipUrl || charge.bankslip_url,
      external_id: charge.id,
      // Dados de multa/juros para exibição no checkout
      late_fees: feeCalculation.isOverdue ? {
        original_amount: feeCalculation.originalAmount,
        fine_amount: feeCalculation.fineAmount,
        interest_amount: feeCalculation.interestAmount,
        total_amount: feeCalculation.totalAmount,
        days_overdue: feeCalculation.daysOverdue
      } : null
    };
    
    console.log('=== RESPONSE DATA ===');
    console.log(JSON.stringify(responseData, null, 2));
    console.log('====================');

    return new Response(
      JSON.stringify(responseData),
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
