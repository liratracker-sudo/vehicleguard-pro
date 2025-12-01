import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  // Relacionamentos
  clients?: {
    name: string;
    email: string | null;
    phone: string;
  } | null;
}

export function usePayments() {
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadPayments = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.company_id) {
        throw new Error('Perfil da empresa não encontrado');
      }

      const { data, error } = await supabase
        .from('payment_transactions')
        .select(`
          *,
          clients (
            name,
            email,
            phone
          )
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setPayments(data as any || []);
    } catch (error: any) {
      console.error('Erro ao carregar pagamentos:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar pagamentos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createPayment = async (paymentData: {
    client_id: string;
    contract_id?: string;
    transaction_type: string;
    amount: number;
    due_date?: string;
    payment_gateway?: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.company_id) {
        throw new Error('Perfil da empresa não encontrado');
      }

      // Primeiro inserir a transação
      const { data: transaction, error: insertError } = await supabase
        .from('payment_transactions')
        .insert({
          ...paymentData,
          company_id: profile.company_id,
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

      await loadPayments(); // Recarregar a lista
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

      await loadPayments(); // Recarregar a lista
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

  // Real-time subscription for payment updates
  useEffect(() => {
    loadPayments();

    // Subscribe to real-time changes in payment_transactions
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
          console.log('Payment transaction updated:', payload);
          // Reload payments when there's a change
          loadPayments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    payments,
    loading,
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
  // Simular delay de API
  await new Promise(resolve => setTimeout(resolve, 1000));

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