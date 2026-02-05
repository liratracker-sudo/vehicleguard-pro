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

  const deletePayment = async (paymentId: string, reason?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-management', {
        body: {
          action: 'delete_payment',
          payment_id: paymentId,
          data: { cancellation_reason: reason }
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

      if (!data?.success) {
        throw new Error(data?.message || data?.error || 'Falha ao reenviar a notificação.');
      }

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

      if (!data?.success) {
        toast({ title: "Aviso", description: data?.message || data?.error || "Não foi possível gerar a segunda via.", variant: "destructive" });
        return data;
      }

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

      if (!data?.success) {
        throw new Error(data?.error || 'Não foi possível obter o saldo da empresa.');
      }

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

      if (!data?.success) {
        throw new Error(data?.error || 'Falha ao gerar cobranças automáticas.');
      }

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

  const deletePermanently = async (paymentId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-management', {
        body: {
          action: 'delete_permanently',
          payment_id: paymentId
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Cobrança excluída permanentemente!"
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

  const protestPayment = async (paymentId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-management', {
        body: {
          action: 'protest_payment',
          payment_id: paymentId
        }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.message || data?.error || 'Falha ao protestar cobrança');
      }

      toast({
        title: "Sucesso",
        description: "Cobrança protestada com sucesso! Notificações automáticas foram pausadas."
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

  const undoProtest = async (paymentId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-management', {
        body: {
          action: 'undo_protest',
          payment_id: paymentId
        }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.message || data?.error || 'Falha ao remover protesto');
      }

      toast({
        title: "Sucesso",
        description: "Protesto removido! Notificações automáticas serão retomadas."
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

  const updateDueDate = async (paymentId: string, newDueDate: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-management', {
        body: {
          action: 'update_due_date',
          payment_id: paymentId,
          data: { new_due_date: newDueDate }
        }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.message || data?.error || 'Falha ao atualizar vencimento.');
      }

      toast({
        title: "Sucesso",
        description: "Data de vencimento atualizada!"
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
    deletePermanently,
    resendNotification,
    generateSecondCopy,
    getCompanyBalance,
    generateAutomaticCharges,
    protestPayment,
    undoProtest,
    updateDueDate
  };
}