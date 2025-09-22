import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface NotificationDebug {
  id: string;
  payment_id: string;
  status: string;
  event_type: string;
  offset_days: number;
  scheduled_for: string;
  sent_at: string | null;
  attempts: number;
  last_error: string | null;
  message_body: string | null;
  created_at: string;
  payment: {
    amount: number;
    due_date: string;
    status: string;
  };
  client: {
    name: string;
    phone: string;
  };
}

export function useNotificationDebug() {
  const [notifications, setNotifications] = useState<NotificationDebug[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAllNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_notifications')
        .select(`
          *,
          payment_transactions!inner(amount, due_date, status),
          clients!inner(name, phone)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading notifications:', error);
        return;
      }

      const formattedData = data?.map(item => ({
        id: item.id,
        payment_id: item.payment_id,
        status: item.status,
        event_type: item.event_type,
        offset_days: item.offset_days,
        scheduled_for: item.scheduled_for,
        sent_at: item.sent_at,
        attempts: item.attempts,
        last_error: item.last_error,
        message_body: item.message_body,
        created_at: item.created_at,
        payment: {
          amount: item.payment_transactions.amount,
          due_date: item.payment_transactions.due_date,
          status: item.payment_transactions.status
        },
        client: {
          name: item.clients.name,
          phone: item.clients.phone
        }
      })) || [];

      setNotifications(formattedData);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotificationsForPayment = async (paymentId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_notifications')
        .select(`
          *,
          payment_transactions!inner(amount, due_date, status),
          clients!inner(name, phone)
        `)
        .eq('payment_id', paymentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading notifications for payment:', error);
        return;
      }

      const formattedData = data?.map(item => ({
        id: item.id,
        payment_id: item.payment_id,
        status: item.status,
        event_type: item.event_type,
        offset_days: item.offset_days,
        scheduled_for: item.scheduled_for,
        sent_at: item.sent_at,
        attempts: item.attempts,
        last_error: item.last_error,
        message_body: item.message_body,
        created_at: item.created_at,
        payment: {
          amount: item.payment_transactions.amount,
          due_date: item.payment_transactions.due_date,
          status: item.payment_transactions.status
        },
        client: {
          name: item.clients.name,
          phone: item.clients.phone
        }
      })) || [];

      setNotifications(formattedData);
    } catch (error) {
      console.error('Error loading notifications for payment:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllNotifications();
  }, []);

  return {
    notifications,
    loading,
    loadAllNotifications,
    loadNotificationsForPayment
  };
}