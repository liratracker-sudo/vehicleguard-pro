import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Search, MoreHorizontal, Send, X, MessageSquare, Clock, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePaymentNotifications } from "@/hooks/usePaymentNotifications";

export function NotificationHistory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  
  const {
    notifications,
    loading,
    resendNotification,
    skipNotification,
    getStatusColor,
    getEventTypeLabel
  } = usePaymentNotifications();

  const filteredNotifications = notifications.filter(notification =>
    notification.payment_transactions?.clients?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    notification.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    notification.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'sent':
        return 'Enviado';
      case 'failed':
        return 'Falhou';
      case 'skipped':
        return 'Ignorado';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Notificações</CardTitle>
          <CardDescription>Carregando...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Histórico de Notificações
          </CardTitle>
          <CardDescription>
            Acompanhe todas as notificações de cobrança enviadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, tipo ou status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Agendado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tentativas</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {searchTerm ? 'Nenhuma notificação encontrada' : 'Nenhuma notificação registrada'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredNotifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {notification.payment_transactions?.clients?.name || 'Cliente não encontrado'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {notification.payment_transactions?.clients?.phone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getEventTypeLabel(notification.event_type, notification.offset_days)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          R$ {notification.payment_transactions?.amount?.toFixed(2) || '0,00'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Vence: {notification.payment_transactions?.due_date ? 
                            format(new Date(notification.payment_transactions.due_date), 'dd/MM/yyyy') : 
                            'N/A'
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {format(new Date(notification.scheduled_for), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </div>
                        {notification.sent_at && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Send className="h-3 w-3" />
                            {format(new Date(notification.sent_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(notification.status)}>
                          {getStatusLabel(notification.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          {notification.attempts}
                          {notification.last_error && (
                            <div className="text-xs text-red-600 mt-1">
                              Erro
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {notification.message_body && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    Ver Mensagem
                                  </DropdownMenuItem>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Mensagem Enviada</DialogTitle>
                                    <DialogDescription>
                                      Conteúdo da notificação para {notification.payment_transactions?.clients?.name}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="bg-muted p-4 rounded-lg">
                                    <pre className="whitespace-pre-wrap text-sm">
                                      {notification.message_body}
                                    </pre>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                            
                            {notification.status === 'failed' && (
                              <DropdownMenuItem onClick={() => resendNotification(notification.id)}>
                                <Send className="mr-2 h-4 w-4" />
                                Reenviar
                              </DropdownMenuItem>
                            )}
                            
                            {notification.status === 'pending' && (
                              <DropdownMenuItem onClick={() => skipNotification(notification.id)}>
                                <X className="mr-2 h-4 w-4" />
                                Ignorar
                              </DropdownMenuItem>
                            )}
                            
                            {notification.last_error && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    Ver Erro
                                  </DropdownMenuItem>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Erro na Notificação</DialogTitle>
                                    <DialogDescription>
                                      Detalhes do erro ocorrido
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="bg-red-50 p-4 rounded-lg">
                                    <pre className="whitespace-pre-wrap text-sm text-red-800">
                                      {notification.last_error}
                                    </pre>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}