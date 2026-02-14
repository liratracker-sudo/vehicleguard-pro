import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  AlertTriangle, 
  Phone, 
  MessageSquare, 
  Ban, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  History
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDateBR, daysUntil } from "@/lib/timezone";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useBillingManagement } from "@/hooks/useBillingManagement";

interface CriticalPayment {
  id: string;
  amount: number;
  due_date: string;
  days_overdue: number;
  client_id: string;
  client_name: string;
  client_phone: string;
  client_service_status: string;
  payment_url?: string;
}

interface EscalationHistoryItem {
  id: string;
  action_type: string;
  new_status: string;
  days_overdue: number;
  action_details: string;
  created_at: string;
}

export function CriticalDelinquencyPanel() {
  const [criticalPayments, setCriticalPayments] = useState<CriticalPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<CriticalPayment | null>(null);
  const [escalationHistory, setEscalationHistory] = useState<EscalationHistoryItem[]>([]);
  const [suspending, setSuspending] = useState(false);
  const { toast } = useToast();
  const { resendNotification } = useBillingManagement();

  useEffect(() => {
    loadCriticalPayments();
  }, []);

  const loadCriticalPayments = async () => {
    try {
      setLoading(true);
      
      // Get user's company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) return;

      // Get overdue payments with 15+ days
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      
      const { data: payments, error } = await supabase
        .from('payment_transactions')
        .select(`
          id,
          amount,
          due_date,
          payment_url,
          client_id,
          clients (
            id,
            name,
            phone,
            service_status
          )
        `)
        .eq('company_id', profile.company_id)
        .in('status', ['pending', 'overdue'])
        .is('protested_at', null)
        .lte('due_date', fifteenDaysAgo.toISOString().split('T')[0])
        .order('due_date', { ascending: true });

      if (error) throw error;

      const criticalList: CriticalPayment[] = (payments || []).map(p => ({
        id: p.id,
        amount: p.amount,
        due_date: p.due_date,
        days_overdue: Math.abs(daysUntil(p.due_date)),
        client_id: p.client_id,
        client_name: (p.clients as any)?.name || 'Desconhecido',
        client_phone: (p.clients as any)?.phone || '',
        client_service_status: (p.clients as any)?.service_status || 'active',
        payment_url: p.payment_url
      }));

      setCriticalPayments(criticalList);
    } catch (error) {
      console.error('Error loading critical payments:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar pagamentos críticos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEscalationHistory = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('client_escalation_history')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setEscalationHistory(data || []);
    } catch (error) {
      console.error('Error loading escalation history:', error);
    }
  };

  const handleSuspendService = async () => {
    if (!selectedPayment) return;

    try {
      setSuspending(true);

      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user?.id)
        .single();

      // Update client service status
      const { error: updateError } = await supabase
        .from('clients')
        .update({ service_status: 'suspended' })
        .eq('id', selectedPayment.client_id);

      if (updateError) throw updateError;

      // Log the escalation
      await supabase
        .from('client_escalation_history')
        .insert({
          company_id: profile?.company_id,
          client_id: selectedPayment.client_id,
          payment_id: selectedPayment.id,
          previous_status: selectedPayment.client_service_status,
          new_status: 'suspended',
          escalation_level: 5,
          days_overdue: selectedPayment.days_overdue,
          action_type: 'manual_suspension',
          action_details: `Serviço suspenso manualmente por inadimplência de R$ ${selectedPayment.amount.toFixed(2)}`,
          created_by: user?.id
        });

      toast({
        title: "Serviço suspenso",
        description: `Cliente ${selectedPayment.client_name} foi suspenso por inadimplência`
      });

      setShowSuspendDialog(false);
      setSelectedPayment(null);
      loadCriticalPayments();
    } catch (error) {
      console.error('Error suspending service:', error);
      toast({
        title: "Erro",
        description: "Falha ao suspender serviço",
        variant: "destructive"
      });
    } finally {
      setSuspending(false);
    }
  };

  const handleReactivateService = async (payment: CriticalPayment) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user?.id)
        .single();

      // Update client service status
      const { error: updateError } = await supabase
        .from('clients')
        .update({ service_status: 'active' })
        .eq('id', payment.client_id);

      if (updateError) throw updateError;

      // Log the reactivation
      await supabase
        .from('client_escalation_history')
        .insert({
          company_id: profile?.company_id,
          client_id: payment.client_id,
          payment_id: payment.id,
          previous_status: payment.client_service_status,
          new_status: 'active',
          escalation_level: 0,
          days_overdue: payment.days_overdue,
          action_type: 'manual_reactivation',
          action_details: 'Serviço reativado manualmente',
          created_by: user?.id
        });

      toast({
        title: "Serviço reativado",
        description: `Cliente ${payment.client_name} foi reativado`
      });

      loadCriticalPayments();
    } catch (error) {
      console.error('Error reactivating service:', error);
      toast({
        title: "Erro",
        description: "Falha ao reativar serviço",
        variant: "destructive"
      });
    }
  };

  const handleSendNotification = async (paymentId: string) => {
    try {
      await resendNotification(paymentId);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const openWhatsApp = (phone: string, clientName: string, amount: number, daysOverdue: number) => {
    const message = encodeURIComponent(
      `Olá ${clientName}, notamos que seu pagamento de R$ ${amount.toFixed(2)} está com ${daysOverdue} dias de atraso. Por favor, regularize o quanto antes para evitar a suspensão do serviço.`
    );
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
  };

  const getSeverityColor = (days: number) => {
    if (days >= 30) return 'bg-red-600 hover:bg-red-700';
    if (days >= 21) return 'bg-red-500 hover:bg-red-600';
    return 'bg-orange-500 hover:bg-orange-600';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'suspended':
        return <Badge variant="destructive">Suspenso</Badge>;
      case 'warning':
        return <Badge className="bg-amber-500">Em Aviso</Badge>;
      case 'blocked':
        return <Badge variant="destructive">Bloqueado</Badge>;
      default:
        return <Badge variant="outline">Ativo</Badge>;
    }
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'notification_sent':
        return 'Notificação enviada';
      case 'status_changed':
        return 'Status alterado';
      case 'manual_suspension':
        return 'Suspensão manual';
      case 'manual_reactivation':
        return 'Reativação manual';
      default:
        return actionType;
    }
  };

  if (criticalPayments.length === 0 && !loading) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-lg text-destructive">
                  Inadimplência Crítica
                </CardTitle>
                <Badge variant="destructive" className="ml-2">
                  {criticalPayments.length} cliente{criticalPayments.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent className="overflow-visible">
          <CardContent className="pt-0 overflow-visible">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-destructive/10">
                      <TableHead className="font-semibold w-[30%]">Cliente</TableHead>
                      <TableHead className="font-semibold text-right w-[15%]">Valor</TableHead>
                      <TableHead className="font-semibold w-[15%]">Atraso</TableHead>
                      <TableHead className="font-semibold w-[15%]">Status</TableHead>
                      <TableHead className="font-semibold text-right w-[25%]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {criticalPayments.map((payment) => (
                      <TableRow key={payment.id} className="bg-background hover:bg-destructive/5">
                        <TableCell className="font-medium">
                          {payment.client_name}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getSeverityColor(payment.days_overdue)} text-white border-0`}>
                            {payment.days_overdue}d atraso
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(payment.client_service_status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <TooltipProvider delayDuration={0}>
                            <div className="flex items-center justify-end gap-0.5 flex-wrap">
                              {/* WhatsApp Manual */}
                              {payment.client_phone && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                                      onClick={() => openWhatsApp(
                                        payment.client_phone,
                                        payment.client_name,
                                        payment.amount,
                                        payment.days_overdue
                                      )}
                                    >
                                      <MessageSquare className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="z-50">WhatsApp Manual</TooltipContent>
                                </Tooltip>
                              )}

                              {/* Enviar Notificação */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-sky-600 hover:text-sky-700 hover:bg-sky-100"
                                    onClick={() => handleSendNotification(payment.id)}
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="z-50">Reenviar Notificação</TooltipContent>
                              </Tooltip>

                              {/* Link de Pagamento */}
                              {payment.payment_url && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                                      onClick={() => window.open(payment.payment_url, '_blank')}
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="z-50">Abrir Link</TooltipContent>
                                </Tooltip>
                              )}

                              {/* Histórico */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-gray-600 hover:text-gray-700 hover:bg-gray-100"
                                    onClick={() => {
                                      setSelectedPayment(payment);
                                      loadEscalationHistory(payment.client_id);
                                      setShowHistoryDialog(true);
                                    }}
                                  >
                                    <History className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="z-50">Histórico</TooltipContent>
                              </Tooltip>

                              {/* Suspender/Reativar */}
                              {payment.client_service_status === 'suspended' ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
                                      onClick={() => handleReactivateService(payment)}
                                    >
                                      <RefreshCw className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="z-50">Reativar Serviço</TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => {
                                        setSelectedPayment(payment);
                                        setShowSuspendDialog(true);
                                      }}
                                    >
                                      <Ban className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="z-50">Suspender Serviço</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>

      {/* Dialog de Suspensão */}
      <AlertDialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Ban className="h-5 w-5" />
              Suspender Serviço
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja suspender o serviço de <strong>{selectedPayment?.client_name}</strong>?
              <br /><br />
              <span className="text-sm text-muted-foreground">
                • Pagamento de R$ {selectedPayment?.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                <br />
                • {selectedPayment?.days_overdue} dias de atraso
                <br />
                • O cliente será notificado sobre a suspensão
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspendService}
              disabled={suspending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {suspending ? 'Suspendendo...' : 'Confirmar Suspensão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Histórico */}
      <AlertDialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Escalada - {selectedPayment?.client_name}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {escalationHistory.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhum histórico de escalada encontrado
              </p>
            ) : (
              <div className="space-y-3">
                {escalationHistory.map((item) => (
                  <div key={item.id} className="border rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline">{getActionLabel(item.action_type)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{item.action_details}</p>
                    <div className="flex gap-2 mt-1 text-xs">
                      <span>Status: <strong>{item.new_status}</strong></span>
                      <span>•</span>
                      <span>{item.days_overdue}d atraso</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}
