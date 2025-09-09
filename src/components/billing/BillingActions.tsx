import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  MoreHorizontal, 
  CheckCircle, 
  XCircle, 
  Send, 
  FileText, 
  Copy,
  ExternalLink 
} from "lucide-react";
import { PaymentTransaction } from "@/hooks/usePayments";
import { useBillingManagement } from "@/hooks/useBillingManagement";

interface BillingActionsProps {
  payment: PaymentTransaction;
  onUpdate: () => void;
  showDeletePermanently?: boolean;
}

export function BillingActions({ payment, onUpdate, showDeletePermanently = false }: BillingActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { 
    loading,
    updatePaymentStatus,
    deletePayment,
    deletePermanently,
    resendNotification,
    generateSecondCopy
  } = useBillingManagement();

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      await updatePaymentStatus(payment.id, newStatus, newStatus === 'paid' ? new Date().toISOString() : undefined);
      onUpdate();
    } catch (error) {
      console.error('Error updating payment status:', error);
    }
  };

  const handleDelete = async () => {
    try {
      if (showDeletePermanently) {
        // For permanent deletion, we need a new function
        await deletePermanently(payment.id);
      } else {
        // For cancelling, use existing function
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
      alert('Cliente não possui telefone cadastrado');
      return;
    }
    
    try {
      await resendNotification(payment.id);
    } catch (error) {
      console.error('Error resending notification:', error);
    }
  };

  const handleGenerateSecondCopy = async () => {
    try {
      const result = await generateSecondCopy(payment.id);
      
      if (result?.data?.payment_url) {
        window.open(result.data.payment_url, '_blank');
      } else if (result?.data?.pix_code) {
        navigator.clipboard.writeText(result.data.pix_code);
        alert('Código PIX copiado para a área de transferência');
      } else {
        onUpdate(); // Refresh to get updated data
      }
    } catch (error) {
      console.error('Error generating second copy:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-success/20 text-success border-success/30">Pago</Badge>;
      case 'pending':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Pendente</Badge>;
      case 'overdue':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Vencido</Badge>;
      case 'cancelled':
        return <Badge variant="outline">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copiado para a área de transferência`);
  };

  return (
    <div className="flex items-center gap-2">
      {getStatusBadge(payment.status)}
      
      {/* Quick actions for common payment methods */}
      {payment.payment_url && (
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => window.open(payment.payment_url!, '_blank')}
          className="h-8"
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          Link
        </Button>
      )}
      
      {payment.pix_code && (
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => copyToClipboard(payment.pix_code!, 'Código PIX')}
          className="h-8"
        >
          <Copy className="w-3 h-3 mr-1" />
          PIX
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {payment.status === 'pending' && (
            <DropdownMenuItem 
              onClick={() => handleStatusUpdate('paid')}
              disabled={loading}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Marcar como Pago
            </DropdownMenuItem>
          )}
          
          {payment.status !== 'cancelled' && payment.status !== 'paid' && (
            <>
              <DropdownMenuItem 
                onClick={handleResendNotification}
                disabled={loading || !payment.clients?.phone}
              >
                <Send className="mr-2 h-4 w-4" />
                Reenviar Notificação
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={handleGenerateSecondCopy}
                disabled={loading}
              >
                <FileText className="mr-2 h-4 w-4" />
                Gerar 2ª Via
              </DropdownMenuItem>
            </>
          )}
          
          <DropdownMenuSeparator />
          
          {showDeletePermanently ? (
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem 
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive focus:text-destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Excluir Permanentemente
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir Cobrança Permanentemente</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir permanentemente esta cobrança? Esta ação não pode ser desfeita e a cobrança será removida completamente do sistema.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDelete}
                    disabled={loading}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Confirmar Exclusão
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem 
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive focus:text-destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancelar Cobrança
                </DropdownMenuItem>
              </AlertDialogTrigger>
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
                    Confirmar Cancelamento
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}