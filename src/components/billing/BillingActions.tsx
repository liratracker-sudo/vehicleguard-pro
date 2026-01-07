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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { formatDateBR } from "@/lib/timezone";

interface BillingActionsProps {
  payment: PaymentTransaction;
  onUpdate: () => void;
  showDeletePermanently?: boolean;
}

const CANCELLATION_REASONS = [
  { value: "cliente_solicitou", label: "Cliente solicitou cancelamento" },
  { value: "cobranca_duplicada", label: "Cobrança duplicada" },
  { value: "erro_valor", label: "Erro no valor/dados" },
  { value: "acordo_pagamento", label: "Acordo de pagamento" },
  { value: "outro", label: "Outro motivo" },
];

export function BillingActions({ payment, onUpdate, showDeletePermanently = false }: BillingActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPaidDialog, setShowPaidDialog] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
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

  const handleCancel = async () => {
    if (!selectedReason) {
      toast({
        title: "Erro",
        description: "Selecione um motivo para o cancelamento",
        variant: "destructive"
      });
      return;
    }

    if (selectedReason === "outro" && !customReason.trim()) {
      toast({
        title: "Erro",
        description: "Descreva o motivo do cancelamento",
        variant: "destructive"
      });
      return;
    }

    const reason = selectedReason === "outro" 
      ? customReason.trim()
      : CANCELLATION_REASONS.find(r => r.value === selectedReason)?.label || selectedReason;

    try {
      await deletePayment(payment.id, reason);
      setShowCancelDialog(false);
      setSelectedReason("");
      setCustomReason("");
      onUpdate();
    } catch (error) {
      console.error('Error cancelling payment:', error);
    }
  };

  const handleDeletePermanently = async () => {
    try {
      await deletePermanently(payment.id);
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

  const resetCancelDialog = () => {
    setShowCancelDialog(false);
    setSelectedReason("");
    setCustomReason("");
  };

  // Para cobranças canceladas, mostrar apenas excluir permanentemente
  if (showDeletePermanently) {
    return (
      <TooltipProvider>
        <div className="flex items-center justify-end gap-3">
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
                  onClick={handleDeletePermanently}
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
      <div className="flex items-center justify-end gap-3">
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
                onClick={() => setShowCancelDialog(true)}
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

        {/* Dialog de confirmação - Cancelar com motivo */}
        <Dialog open={showCancelDialog} onOpenChange={resetCancelDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cancelar Cobrança</DialogTitle>
              <DialogDescription>
                Informe o motivo do cancelamento para registro e auditoria.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Info da cobrança */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <p className="text-sm font-medium">{payment.clients?.name || 'Cliente'}</p>
                <p className="text-sm text-muted-foreground">
                  R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • Vencimento: {payment.due_date ? formatDateBR(payment.due_date) : '-'}
                </p>
              </div>

              {/* Seleção do motivo */}
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo do cancelamento *</Label>
                <Select value={selectedReason} onValueChange={setSelectedReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANCELLATION_REASONS.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Campo de texto para "Outro" */}
              {selectedReason === "outro" && (
                <div className="space-y-2">
                  <Label htmlFor="customReason">Descreva o motivo *</Label>
                  <Textarea
                    id="customReason"
                    placeholder="Descreva o motivo do cancelamento..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={resetCancelDialog}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={loading || !selectedReason || (selectedReason === "outro" && !customReason.trim())}
              >
                Confirmar Cancelamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
