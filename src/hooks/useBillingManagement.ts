import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CompanyBalance {
  total_received: number;
  total_pending: number;
  total_overdue: number;
  total_balance: number;
}

export function useBillingManagement() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const updatePaymentStatus = async (paymentId: string, status: string, paidAt?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-management', {
        body: {
          action: 'update_status',
          payment_id: paymentId,
          data: { status, paid_at: paidAt }
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Status da cobrança atualizado com sucesso!"
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deletePayment = async (paymentId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-management', {
        body: {
          action: 'delete_payment',
          payment_id: paymentId
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Cobrança cancelada com sucesso!"
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const resendNotification = async (paymentId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-management', {
        body: {
          action: 'resend_notification',
          payment_id: paymentId
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Notificação reenviada com sucesso!"
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const generateSecondCopy = async (paymentId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-management', {
        body: {
          action: 'generate_second_copy',
          payment_id: paymentId
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Segunda via gerada com sucesso!"
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getCompanyBalance = async (): Promise<CompanyBalance> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-management', {
        body: {
          action: 'get_company_balance'
        }
      });

      if (error) throw error;

      return data.data;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const generateAutomaticCharges = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-charges', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Cobranças automáticas geradas com sucesso!"
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    updatePaymentStatus,
    deletePayment,
    resendNotification,
    generateSecondCopy,
    getCompanyBalance,
    generateAutomaticCharges
  };
}