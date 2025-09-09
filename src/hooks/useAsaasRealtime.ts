import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AsaasStatusUpdate {
  paymentId: string;
  oldStatus: string;
  newStatus: string;
  paidAt?: string;
  updatedAt: string;
}

export function useAsaasRealtime() {
  const [lastUpdate, setLastUpdate] = useState<AsaasStatusUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Subscribe to payment_transactions changes for real-time updates
    const channel = supabase
      .channel('asaas-payment-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payment_transactions',
          filter: 'payment_gateway=eq.asaas'
        },
        (payload) => {
          console.log('Asaas payment updated:', payload);
          
          const { old, new: new_record } = payload;
          
          if (old.status !== new_record.status) {
            const update: AsaasStatusUpdate = {
              paymentId: new_record.id,
              oldStatus: old.status,
              newStatus: new_record.status,
              paidAt: new_record.paid_at,
              updatedAt: new_record.updated_at
            };

            setLastUpdate(update);

            // Show toast notification for status changes
            let message = '';
            let variant: 'default' | 'destructive' | 'success' = 'default';

            switch (new_record.status) {
              case 'paid':
                message = `Pagamento confirmado! R$ ${Number(new_record.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                variant = 'default';
                break;
              case 'overdue':
                message = `Pagamento em atraso: R$ ${Number(new_record.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                variant = 'destructive';
                break;
              case 'cancelled':
                message = `Pagamento cancelado: R$ ${Number(new_record.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                variant = 'destructive';
                break;
            }

            if (message) {
              toast({
                title: 'Status Atualizado - Asaas',
                description: message,
                variant: variant as any
              });
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          console.log('Connected to Asaas real-time updates');
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          console.log('Disconnected from Asaas real-time updates');
        }
      });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [toast]);

  const triggerSync = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('asaas-sync-payments');
      
      if (error) throw error;

      toast({
        title: 'Sincronização Iniciada',
        description: 'Verificando status dos pagamentos no Asaas...'
      });

      return data;
    } catch (error: any) {
      console.error('Error triggering sync:', error);
      toast({
        title: 'Erro na Sincronização',
        description: error.message || 'Erro ao sincronizar com Asaas',
        variant: 'destructive'
      });
      throw error;
    }
  };

  return {
    lastUpdate,
    isConnected,
    triggerSync
  };
}