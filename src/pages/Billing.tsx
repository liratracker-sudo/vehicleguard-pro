import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, DollarSign, AlertCircle, Calendar, Search, X, ChevronDown, ChevronUp } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { BillingHistory } from "@/components/billing/BillingHistory"
import { PaymentForm } from "@/components/billing/PaymentForm"
import { BillingActions } from "@/components/billing/BillingActions"
import { usePayments } from "@/hooks/usePayments"
import { useBillingManagement } from "@/hooks/useBillingManagement"
import { CpfLookup } from "@/components/billing/CpfLookup"
import { formatDateBR, daysUntil } from "@/lib/timezone"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const BillingPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const clientIdFilter = searchParams.get('client_id')
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showStats, setShowStats] = useState(false)
  const { toast } = useToast()
  
  const { payments, loading, loadPayments } = usePayments()
  const { 
    getCompanyBalance 
  } = useBillingManagement()
  
  const [companyBalance, setCompanyBalance] = useState<any>(null)

  useEffect(() => {
    loadCompanyBalance()
  }, [])

  const loadCompanyBalance = async () => {
    try {
      const balance = await getCompanyBalance()
      setCompanyBalance(balance)
    } catch (error) {
      console.error('Error loading company balance:', error)
    }
  }

  const clearClientFilter = () => {
    setSearchParams({})
  }

  const filteredClientName = clientIdFilter
    ? payments.find(p => p.client_id === clientIdFilter)?.clients?.name 
    : null

  const filteredPayments = payments.filter(payment => {
    if (payment.status === 'cancelled') return false
    if (clientIdFilter && payment.client_id !== clientIdFilter) return false
    if (search) {
      const searchLower = search.toLowerCase()
      const matchesSearch = 
        payment.clients?.name?.toLowerCase().includes(searchLower) ||
        payment.external_id?.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }
    if (statusFilter !== "all" && payment.status !== statusFilter) return false
    return true
  })

  // Função para calcular prioridade de ordenação
  const getPaymentPriority = (payment: any): number => {
    if (payment.status === 'paid') return 6; // Pagos no final
    
    if (payment.due_date) {
      const days = daysUntil(payment.due_date);
      if (days < 0) return 1;   // Vencido (atrasado)
      if (days === 0) return 2; // Vence Hoje
      if (days <= 3) return 3;  // Esgotando (1-3 dias)
      if (days <= 7) return 4;  // Próximo (4-7 dias)
    }
    
    return 5; // Pendente normal (> 7 dias)
  };

  // Ordenar pagamentos por prioridade (urgentes primeiro, pagos no final)
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    const priorityA = getPaymentPriority(a);
    const priorityB = getPaymentPriority(b);
    
    if (priorityA !== priorityB) return priorityA - priorityB;
    
    // Mesma prioridade: ordenar por data (mais próximo primeiro)
    const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
    const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
    return dateA - dateB;
  });

  const totalReceived = companyBalance?.total_received ?? payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)
  const totalPending = companyBalance?.total_pending ?? payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0)
  const totalOverdue = companyBalance?.total_overdue ?? payments.filter(p => p.status === 'overdue').reduce((sum, p) => sum + p.amount, 0)
  const totalBalance = companyBalance?.total_balance ?? (totalPending + totalOverdue)

  // Função para obter badge de status
  const getStatusBadge = (payment: any) => {
    if (payment.status === 'paid') {
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 font-medium">
          Pago
        </Badge>
      )
    }
    
    if (payment.status === 'overdue' || (payment.due_date && daysUntil(payment.due_date) < 0)) {
      const daysOverdue = payment.due_date ? Math.abs(daysUntil(payment.due_date)) : 0
      return (
        <Badge className="bg-red-600 hover:bg-red-700 text-white border-0 font-medium">
          {daysOverdue > 0 ? `${daysOverdue}d atraso` : 'Vencido'}
        </Badge>
      )
    }
    
    if (payment.due_date) {
      const days = daysUntil(payment.due_date)
      if (days === 0) {
        return (
          <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 font-medium">
            Vence Hoje
          </Badge>
        )
      }
      if (days <= 3) {
        return (
          <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-0 font-medium">
            Esgotando
          </Badge>
        )
      }
      if (days <= 7) {
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 font-medium">
            Próximo
          </Badge>
        )
      }
    }
    
    return (
      <Badge className="bg-sky-500 hover:bg-sky-600 text-white border-0 font-medium">
        Pendente
      </Badge>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header Compacto */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cobranças</h1>
            <p className="text-sm text-muted-foreground">
              {filteredPayments.length} cobranças ativas
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Nova Cobrança
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <PaymentForm
                onSuccess={() => {
                  setIsDialogOpen(false)
                  loadPayments()
                  loadCompanyBalance()
                }}
                onCancel={() => setIsDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Colapsável */}
        <Collapsible open={showStats} onOpenChange={setShowStats}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Ver Resumo Financeiro
              </span>
              {showStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Card className="bg-emerald-500/10 border-emerald-500/20">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Recebido</span>
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-amber-500/10 border-amber-500/20">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Pendente</span>
                    <Calendar className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                    R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-red-500/10 border-red-500/20">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-red-700 dark:text-red-400">Vencido</span>
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <div className="text-lg font-bold text-red-700 dark:text-red-400">
                    R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-primary/10 border-primary/20">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-primary">Saldo Devedor</span>
                    <AlertCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-lg font-bold text-primary">
                    R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Tabs */}
        <Tabs defaultValue="manage" className="space-y-4">
          <TabsList className="h-9">
            <TabsTrigger value="manage" className="text-xs">Cobranças</TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs">Canceladas</TabsTrigger>
            <TabsTrigger value="cpf-lookup" className="text-xs">Consultar CPF</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="manage" className="space-y-4">
            {/* Filtro de cliente (se ativo) */}
            {clientIdFilter && (
              <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md text-sm">
                <DollarSign className="w-4 h-4 text-primary" />
                <span>Filtrando: <strong>{filteredClientName}</strong></span>
                <Button variant="ghost" size="sm" onClick={clearClientFilter} className="ml-auto h-6 px-2">
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}

            {/* Barra de Busca Compacta */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabela Limpa */}
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold">Cliente</TableHead>
                    <TableHead className="font-semibold">Plano</TableHead>
                    <TableHead className="font-semibold text-right">Valor</TableHead>
                    <TableHead className="font-semibold">Vencimento</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : sortedPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma cobrança encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedPayments.map((payment) => (
                      <TableRow key={payment.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">
                          {payment.clients?.name || 'Sistema'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-medium uppercase">
                            {payment.contracts?.plans?.name || (payment as any).description || 'Avulsa'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payment.due_date ? formatDateBR(payment.due_date) : '-'}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(payment)}
                        </TableCell>
                        <TableCell className="text-right">
                          <BillingActions 
                            payment={payment} 
                            onUpdate={() => {
                              loadPayments()
                              loadCompanyBalance()
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-4">
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold">Cliente</TableHead>
                    <TableHead className="font-semibold text-right">Valor</TableHead>
                    <TableHead className="font-semibold">Cancelado em</TableHead>
                    <TableHead className="font-semibold text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.filter(p => p.status === 'cancelled').length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhuma cobrança cancelada
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.filter(p => p.status === 'cancelled').map((payment) => (
                      <TableRow key={payment.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">
                          {payment.clients?.name || 'Sistema'}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateBR(payment.updated_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <BillingActions 
                            payment={payment} 
                            onUpdate={() => {
                              loadPayments()
                              loadCompanyBalance()
                            }}
                            showDeletePermanently
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="cpf-lookup">
            <CpfLookup />
          </TabsContent>

          <TabsContent value="history">
            <BillingHistory />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

export default BillingPage
