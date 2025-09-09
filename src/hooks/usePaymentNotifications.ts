import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PaymentNotification {
  id: string;
  company_id: string;
  payment_id: string;
  client_id: string;
  event_type: 'pre_due' | 'on_due' | 'post_due';
  offset_days: number;
  scheduled_for: string;
  sent_at: string | null;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  last_error: string | null;
  message_body: string | null;
  created_at: string;
  updated_at: string;
  // Relacionamentos
  payment_transactions?: {
    id: string;
    amount: number;
    due_date: string;
    status: string;
    transaction_type: string;
    clients?: {
      name: string;
      phone: string;
      email: string | null;
    };
  };
}

export function usePaymentNotifications() {
  const [notifications, setNotifications] = useState<PaymentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadNotifications = async () => {
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
        .single();

      if (!profile?.company_id) {
        throw new Error('Perfil da empresa não encontrado');
      }

      const { data, error } = await supabase
        .from('payment_notifications')
        .select(`
          *,
          payment_transactions (
            id,
            amount,
            due_date,
            status,
            transaction_type,
            clients (
              name,
              phone,
              email
            )
          )
        `)
        .eq('company_id', profile.company_id)
        .order('scheduled_for', { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      setNotifications(data as any || []);
    } catch (error: any) {
      console.error('Erro ao carregar notificações:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar notificações de pagamento",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resendNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('payment_notifications')
        .update({
          status: 'pending',
          scheduled_for: new Date().toISOString(),
          attempts: 0,
          last_error: null
        })
        .eq('id', notificationId);

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Notificação reagendada para envio imediato"
      });

      await loadNotifications();
    } catch (error: any) {
      console.error('Erro ao reenviar notificação:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao reenviar notificação",
        variant: "destructive"
      });
    }
  };

  const skipNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('payment_notifications')
        .update({ status: 'skipped' })
        .eq('id', notificationId);

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Notificação marcada como ignorada"
      });

      await loadNotifications();
    } catch (error: any) {
      console.error('Erro ao ignorar notificação:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao ignorar notificação",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'skipped':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventTypeLabel = (eventType: string, offsetDays: number) => {
    switch (eventType) {
      case 'pre_due':
        return `${offsetDays} dia(s) antes`;
      case 'on_due':
        return 'No vencimento';
      case 'post_due':
        return `${offsetDays} dia(s) após`;
      default:
        return eventType;
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  return {
    notifications,
    loading,
    loadNotifications,
    resendNotification,
    skipNotification,
    getStatusColor,
    getEventTypeLabel
  };
}