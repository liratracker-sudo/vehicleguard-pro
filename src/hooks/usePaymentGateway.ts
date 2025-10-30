import { supabase } from "@/integrations/supabase/client";

interface GatewaySelection {
  gateway: string | null;
  error?: string;
}

/**
 * Determina qual gateway deve processar um determinado método de pagamento
 * baseado nas configurações da tabela payment_gateway_methods
 */
export async function getGatewayForPaymentMethod(
  companyId: string,
  paymentMethod: string
): Promise<GatewaySelection> {
  try {
    // Normalizar o método de pagamento para o formato usado na tabela
    const normalizedMethod = normalizePaymentMethod(paymentMethod);

    // Buscar configurações ativas para este método e empresa
    const { data: configs, error } = await supabase
      .from('payment_gateway_methods')
      .select('gateway_type, priority')
      .eq('company_id', companyId)
      .eq('payment_method', normalizedMethod)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching gateway config:', error);
      return { gateway: null, error: error.message };
    }

    // Se não houver configuração, retornar null (sem gateway configurado)
    if (!configs || configs.length === 0) {
      console.log(`No gateway configured for ${normalizedMethod} - skipping gateway integration`);
      return { gateway: null };
    }

    // Retornar o gateway com maior prioridade
    const selectedGateway = configs[0].gateway_type;
    console.log(`Selected gateway for ${normalizedMethod}: ${selectedGateway}`);
    
    return { gateway: selectedGateway };
  } catch (error) {
    console.error('Error determining gateway:', error);
    return { 
      gateway: null, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Normaliza o método de pagamento para o formato usado na tabela
 */
function normalizePaymentMethod(method: string): string {
  const normalized = method.toLowerCase().replace(/[_-]/g, '');
  
  // Mapeamento de variações comuns
  const mappings: Record<string, string> = {
    'boleto': 'boleto',
    'pix': 'pix',
    'creditcard': 'credit_card',
    'cartaocredito': 'credit_card',
    'debitcard': 'debit_card',
    'cartaodebito': 'debit_card',
  };

  return mappings[normalized] || method;
}

/**
 * Cria uma cobrança no gateway apropriado baseado no método de pagamento
 */
export async function createChargeInGateway(
  companyId: string,
  paymentMethod: string,
  chargeData: {
    customerId?: string;
    value: number;
    dueDate: string;
    description: string;
    externalReference: string;
    customerData?: {
      name: string;
      email?: string;
      phone?: string;
      document?: string;
    };
  }
) {
  // Determinar qual gateway usar
  const { gateway, error: gatewayError } = await getGatewayForPaymentMethod(
    companyId,
    paymentMethod
  );

  if (gatewayError) {
    throw new Error(`Erro ao determinar gateway: ${gatewayError}`);
  }

  // Se não houver gateway configurado, retornar sem criar cobrança
  if (!gateway) {
    console.log('No gateway configured for this payment method - skipping gateway integration');
    return { 
      success: true, 
      skipped: true,
      message: 'Cobrança criada localmente sem integração de gateway' 
    };
  }

  // Criar cobrança no gateway apropriado
  console.log(`Creating charge in ${gateway} gateway`);

  const integrationFunction = `${gateway}-integration`;
  const billingType = getBillingTypeForGateway(gateway, paymentMethod);

  const { data: response, error } = await supabase.functions.invoke(integrationFunction, {
    body: {
      action: 'create_charge',
      company_id: companyId,
      data: {
        customerId: chargeData.customerId,
        billingType: billingType,
        value: chargeData.value,
        dueDate: chargeData.dueDate,
        description: chargeData.description,
        externalReference: chargeData.externalReference,
        // Incluir dados do cliente se não houver customerId
        ...(chargeData.customerData && !chargeData.customerId ? {
          customer: chargeData.customerData
        } : {})
      }
    }
  });

  if (error) {
    throw new Error(`Erro na integração com ${gateway}: ${error.message}`);
  }

  if (!response?.success) {
    throw new Error(response?.error || `Falha ao criar cobrança no ${gateway}`);
  }

  return response;
}

/**
 * Converte o método de pagamento para o formato esperado por cada gateway
 */
function getBillingTypeForGateway(gateway: string, paymentMethod: string): string {
  const normalized = normalizePaymentMethod(paymentMethod);
  
  // Mapeamento comum para a maioria dos gateways
  const mappings: Record<string, string> = {
    'boleto': 'BOLETO',
    'pix': 'PIX',
    'credit_card': 'CREDIT_CARD',
    'debit_card': 'DEBIT_CARD',
  };

  return mappings[normalized] || 'BOLETO';
}
