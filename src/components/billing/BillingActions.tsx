import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  CheckCircle, 
  XCircle, 
  MessageSquare, 
  Trash2,
  Copy,
  ExternalLink 
} from "lucide-react";
import { PaymentTransaction } from "@/hooks/usePayments";
import { useBillingManagement } from "@/hooks/useBillingManagement";
import { useToast } from "@/hooks/use-toast";

interface BillingActionsProps {
  payment: PaymentTransaction;
  onUpdate: () => void;
  showDeletePermanently?: boolean;
}

export function BillingActions({ payment, onUpdate, showDeletePermanently = false }: BillingActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPaidDialog, setShowPaidDialog] = useState(false);
  const { toast } = useToast();
  const { 
    loading,
    updatePaymentStatus,
    deletePayment,
    deletePermanently,
    resendNotification,
  } = useBillingManagement();

  const handleMarkAsPaid = async () => {
    try {
      await updatePaymentStatus(payment.id, 'paid', new Date().toISOString());
      setShowPaidDialog(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating payment status:', error);
    }
  };

  const handleDelete = async () => {
    try {
      if (showDeletePermanently) {
        await deletePermanently(payment.id);
      } else {
        await deletePayment(payment.id);
      }
      setShowDeleteDialog(false);
      onUpdate();
    } catch (error) {
      console.error('Error deleting payment:', error);
    }
  };

  const handleResendNotification = async () => {
    if (!payment.clients?.phone) {
      toast({
        title: "Erro",
        description: "Cliente não possui telefone cadastrado",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await resendNotification(payment.id);
    } catch (error) {
      console.error('Error resending notification:', error);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência`
    });
  };

  // Para cobranças canceladas, mostrar apenas excluir permanentemente
  if (showDeletePermanently) {
    return (
      <TooltipProvider>
        <div className="flex items-center justify-end gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteDialog(true)}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Excluir permanentemente</TooltipContent>
          </Tooltip>

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Permanentemente</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. A cobrança será removida completamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDelete}
                  disabled={loading}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex items-center justify-end gap-2">
        {/* Link de pagamento */}
        {payment.payment_url && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                onClick={() => window.open(payment.payment_url!, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Abrir link</TooltipContent>
          </Tooltip>
        )}

        {/* Copiar PIX */}
        {payment.pix_code && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 text-teal-600 hover:text-teal-700 hover:bg-teal-100 dark:hover:bg-teal-900/30"
                onClick={() => copyToClipboard(payment.pix_code!, 'Código PIX')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Copiar PIX</TooltipContent>
          </Tooltip>
        )}

        {/* Marcar como pago - apenas se não estiver pago */}
        {payment.status !== 'paid' && payment.status !== 'cancelled' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                onClick={() => setShowPaidDialog(true)}
                disabled={loading}
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Marcar como pago</TooltipContent>
          </Tooltip>
        )}

        {/* Reenviar notificação - apenas se pendente/vencido */}
        {payment.status !== 'paid' && payment.status !== 'cancelled' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 text-sky-600 hover:text-sky-700 hover:bg-sky-100 dark:hover:bg-sky-900/30"
                onClick={handleResendNotification}
                disabled={loading || !payment.clients?.phone}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {payment.clients?.phone ? 'Enviar notificação' : 'Sem telefone'}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Cancelar cobrança - apenas se não estiver pago/cancelado */}
        {payment.status !== 'paid' && payment.status !== 'cancelled' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteDialog(true)}
                disabled={loading}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Cancelar cobrança</TooltipContent>
          </Tooltip>
        )}

        {/* Dialog de confirmação - Marcar como pago */}
        <AlertDialog open={showPaidDialog} onOpenChange={setShowPaidDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Pagamento</AlertDialogTitle>
              <AlertDialogDescription>
                Marcar esta cobrança de R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} como paga?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleMarkAsPaid}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de confirmação - Cancelar */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar Cobrança</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja cancelar esta cobrança? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete}
                disabled={loading}
                className="bg-destructive hover:bg-destructive/90"
              >
                Cancelar Cobrança
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
