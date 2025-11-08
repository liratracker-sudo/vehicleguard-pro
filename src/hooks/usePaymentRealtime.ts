import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentRealtimeOptions {
  transactionId: string;
  onPaymentConfirmed?: () => void;
  onPaymentCancelled?: () => void;
}

/**
 * Hook para ouvir mudanças em tempo real no status de pagamento
 * Mostra notificações automáticas quando o pagamento é confirmado ou cancelado
 */
export const usePaymentRealtime = ({ 
  transactionId, 
  onPaymentConfirmed,
  onPaymentCancelled 
}: PaymentRealtimeOptions) => {
  const { toast } = useToast();

  useEffect(() => {
    if (!transactionId) return;

    console.log('🔴 [Realtime] Iniciando escuta para transação:', transactionId);

    const channel = supabase
      .channel('payment-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payment_transactions',
          filter: `id=eq.${transactionId}`
        },
        (payload) => {
          console.log('🔴 [Realtime] Mudança detectada:', payload);
          
          const newStatus = payload.new.status;
          const oldStatus = payload.old.status;

          // Só processar se o status realmente mudou
          if (newStatus === oldStatus) return;

          // Pagamento confirmado
          if (newStatus === 'paid' && oldStatus !== 'paid') {
            console.log('✅ [Realtime] Pagamento confirmado!');
            
            toast({
              title: '✅ Pagamento Confirmado!',
              description: 'Seu pagamento foi recebido com sucesso.',
              className: 'bg-green-500 text-white border-green-600',
            });

            // Reproduzir som de sucesso (opcional)
            try {
              const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTKH0fPTgjMGHm7A7+OZSA0PVqzn77BdGAg+ltryxnMpBSl+zPLaizsIGGS57OihUBELTKXh8bllHAU2jdXzz3wuBSd6y/HajDwJFmm97eWdTQ0PU6nk8LFiGgk7k9fyx3YrBSl9yvLaiz0KGWO67Oeiux8SRp/g8rxpJAU2jtT00H0uBCd5yfHZjD0JFWS77uWZSg0O');
              audio.play().catch(() => {});
            } catch (e) {}

            onPaymentConfirmed?.();
          }

          // Pagamento cancelado
          if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
            console.log('❌ [Realtime] Pagamento cancelado');
            
            toast({
              title: '❌ Pagamento Cancelado',
              description: 'Este pagamento foi cancelado.',
              variant: 'destructive',
            });

            onPaymentCancelled?.();
          }

          // Pagamento vencido
          if (newStatus === 'overdue' && oldStatus !== 'overdue') {
            console.log('⏰ [Realtime] Pagamento vencido');
            
            toast({
              title: '⏰ Pagamento Vencido',
              description: 'O prazo de pagamento expirou.',
              variant: 'destructive',
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('🔴 [Realtime] Status da conexão:', status);
      });

    return () => {
      console.log('🔴 [Realtime] Desconectando...');
      supabase.removeChannel(channel);
    };
  }, [transactionId, toast, onPaymentConfirmed, onPaymentCancelled]);
};
