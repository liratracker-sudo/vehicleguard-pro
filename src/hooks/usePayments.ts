import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCompanyId } from "@/hooks/useCompanyId";

export interface PaymentTransaction {
  id: string;
  company_id: string;
  client_id: string;
  contract_id: string | null;
  invoice_id: string | null;
  transaction_type: string;
  amount: number;
  due_date: string | null;
  status: string;
  payment_gateway: string | null;
  payment_url: string | null;
  pix_code: string | null;
  barcode: string | null;
  external_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  description?: string | null;
  clients?: {
    name: string;
    email: string | null;
    phone: string;
  } | null;
  contracts?: {
    id: string;
    start_date: string;
    plans?: {
      name: string | null;
      billing_cycle: string | null;
    } | null;
  } | null;
}

interface UsePaymentsReturn {
  payments: PaymentTransaction[];
  loading: boolean;
  error: string | null;
  loadPayments: () => Promise<void>;
  createPayment: (paymentData: CreatePaymentData) => Promise<any>;
  updatePaymentStatus: (paymentId: string, status: string, paidAt?: string) => Promise<void>;
}

interface CreatePaymentData {
  client_id: string;
  contract_id?: string;
  transaction_type: string;
  amount: number;
  due_date?: string;
  payment_gateway?: string;
}

// Debounce helper
function debounce<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

export function usePayments(): UsePaymentsReturn {
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const companyIdRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);

  const loadPayments = useCallback(async () => {
    // Evitar requisições simultâneas
    if (isLoadingRef.current) {
      console.log('[usePayments] Requisição já em andamento, ignorando...');
      return;
    }

    isLoadingRef.current = true;
    console.log('[usePayments] Iniciando carregamento...');
    setLoading(true);
    setError(null);

    try {
      // Usar cache de company_id
      if (!companyIdRef.current) {
        companyIdRef.current = await getCompanyId();
      }

      console.log('[usePayments] Company ID (cached):', companyIdRef.current);

      const { data, error: queryError } = await supabase
        .from('payment_transactions')
        .select(`
          *,
          clients (
            name,
            email,
            phone
          ),
          contracts (
            id,
            start_date,
            plans (
              name,
              billing_cycle
            )
          )
        `)
        .eq('company_id', companyIdRef.current)
        .order('created_at', { ascending: false })
        .limit(500); // Limitar registros para performance

      if (queryError) {
        throw queryError;
      }

      console.log('[usePayments] Pagamentos carregados:', data?.length || 0);
      setPayments(data as PaymentTransaction[] || []);
      setError(null);
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao carregar cobranças';
      console.error('[usePayments] Erro:', errorMessage);
      
      setError(errorMessage);
      setPayments([]);
      
      toast({
        title: "Erro ao carregar",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [toast]);

  const createPayment = async (paymentData: CreatePaymentData) => {
    try {
      const companyId = companyIdRef.current || await getCompanyId();

      const { data: transaction, error: insertError } = await supabase
        .from('payment_transactions')
        .insert({
          ...paymentData,
          company_id: companyId,
          status: 'pending'
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Simular integração com gateway de pagamento
      const paymentResponse = await simulatePaymentGateway(
        paymentData.transaction_type,
        paymentData.amount,
        paymentData.payment_gateway || 'pix'
      );

      // Atualizar transação com resposta do gateway
      const { error: updateError } = await supabase
        .from('payment_transactions')
        .update({
          payment_url: paymentResponse.payment_url,
          pix_code: paymentResponse.pix_code,
          barcode: paymentResponse.barcode,
          external_id: paymentResponse.external_id
        })
        .eq('id', transaction.id);

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Sucesso",
        description: "Cobrança gerada com sucesso!"
      });

      await loadPayments();
      return { ...transaction, ...paymentResponse };
    } catch (error: any) {
      console.error('Erro ao criar pagamento:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao gerar cobrança",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updatePaymentStatus = async (paymentId: string, status: string, paidAt?: string) => {
    try {
      const { error } = await supabase
        .from('payment_transactions')
        .update({
          status,
          paid_at: paidAt || null
        })
        .eq('id', paymentId);

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Status do pagamento atualizado!"
      });

      await loadPayments();
    } catch (error: any) {
      console.error('Erro ao atualizar pagamento:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar pagamento",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Real-time subscription com debounce
  useEffect(() => {
    loadPayments();

    // Debounce para evitar múltiplos reloads
    const debouncedLoad = debounce(() => {
      console.log('[usePayments] Real-time update (debounced)');
      loadPayments();
    }, 500);

    const channel = supabase
      .channel('payment-transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_transactions'
        },
        (payload) => {
          console.log('[usePayments] Real-time event:', payload.eventType);
          debouncedLoad();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPayments]);

  return {
    payments,
    loading,
    error,
    loadPayments,
    createPayment,
    updatePaymentStatus
  };
}

// Simulação de gateway de pagamento
const simulatePaymentGateway = async (
  type: string,
  amount: number,
  gateway: string
): Promise<{
  payment_url?: string;
  pix_code?: string;
  barcode?: string;
  external_id: string;
}> => {
  await new Promise(resolve => setTimeout(resolve, 500));

  const externalId = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  switch (gateway) {
    case 'pix':
      return {
        pix_code: `00020126580014BR.GOV.BCB.PIX01366c7f1fcf-eebe-4a15-b6d1-123456789012520400005303986540${amount.toFixed(2)}5802BR5925SISTEMA DE RASTREAMENTO6009SAO PAULO62070503***63041234`,
        external_id: externalId
      };
    
    case 'boleto':
      return {
        barcode: `23793${Math.random().toString().substr(2, 44)}`,
        external_id: externalId
      };
    
    case 'credit_card':
    case 'link':
      return {
        payment_url: `https://checkout.exemplo.com/pay/${externalId}`,
        external_id: externalId
      };
    
    default:
      return {
        external_id: externalId
      };
  }
};
