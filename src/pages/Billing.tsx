import { useState, useEffect, lazy, Suspense } from "react"
import { useSearchParams } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, DollarSign, AlertCircle, Calendar, Search, X, ChevronDown, ChevronUp, WifiOff, RefreshCw, AlertTriangle, Scale } from "lucide-react"
import { CriticalDelinquencyPanel } from "@/components/billing/CriticalDelinquencyPanel"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { PaymentForm } from "@/components/billing/PaymentForm"
import { BillingActions } from "@/components/billing/BillingActions"
import { usePayments } from "@/hooks/usePayments"
import { useBillingManagement } from "@/hooks/useBillingManagement"
import { CpfLookup } from "@/components/billing/CpfLookup"
import { formatDateBR, daysUntil } from "@/lib/timezone"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ModernStatCard } from "@/components/ui/modern-stat-card"
import { BillingTableSkeleton } from "@/components/billing/BillingTableSkeleton"
import { Skeleton } from "@/components/ui/skeleton"
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

// Lazy load BillingHistory e ProtestedPaymentsTab para carregar apenas quando acessados
const BillingHistory = lazy(() => import("@/components/billing/BillingHistory").then(m => ({ default: m.BillingHistory })))
const ProtestedPaymentsTab = lazy(() => import("@/components/billing/ProtestedPaymentsTab").then(m => ({ default: m.ProtestedPaymentsTab })))

const BillingPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const clientIdFilter = searchParams.get('client_id')
  const urlFilter = searchParams.get('filter')
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState(() => {
    const filter = searchParams.get('filter')
    if (filter === 'overdue') return 'overdue'
    if (filter === 'upcoming_7days') return 'upcoming_7days'
    return 'all'
  })
  const [showStats, setShowStats] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 50
  const { toast } = useToast()
  
  const { payments, loading, error, loadPayments } = usePayments()
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

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, clientIdFilter])

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
    
    // Filtro especial: próximos 7 dias
    if (statusFilter === 'upcoming_7days') {
      if (payment.status === 'paid') return false
      if (!payment.due_date) return false
      const days = daysUntil(payment.due_date)
      return days >= 0 && days <= 7
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

  // Pagination
  const totalPages = Math.ceil(sortedPayments.length / ITEMS_PER_PAGE)
  const paginatedPayments = sortedPayments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )
  const startItem = sortedPayments.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, sortedPayments.length)

  const getPageNumbers = () => {
    const pages: number[] = []
    let start = Math.max(1, currentPage - 2)
    let end = Math.min(totalPages, start + 4)
    start = Math.max(1, end - 4)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  const totalReceived = companyBalance?.total_received ?? payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)
  const totalPending = companyBalance?.total_pending ?? payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0)
  const totalOverdue = companyBalance?.total_overdue ?? payments.filter(p => p.status === 'overdue').reduce((sum, p) => sum + p.amount, 0)
  const totalBalance = companyBalance?.total_balance ?? (totalPending + totalOverdue)

  // Função para obter badge de status
  const getStatusBadge = (payment: any) => {
    if (payment.protested_at) {
      return (
        <Badge className="bg-purple-600 hover:bg-purple-700 text-white border-0 font-medium">
          <Scale className="h-3 w-3 mr-1" />
          Protestado
        </Badge>
      )
    }

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
              {sortedPayments.length > 0 
                ? `Exibindo ${startItem}-${endItem} de ${sortedPayments.length} cobranças`
                : '0 cobranças'}
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Nova Cobrança
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
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
              <ModernStatCard
                title="Recebido"
                value={`R$ ${totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                icon={<DollarSign className="h-5 w-5" />}
                variant="success"
                className="py-2"
              />
              <ModernStatCard
                title="Pendente"
                value={`R$ ${totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                icon={<Calendar className="h-5 w-5" />}
                variant="warning"
                className="py-2"
              />
              <ModernStatCard
                title="Vencido"
                value={`R$ ${totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                icon={<AlertCircle className="h-5 w-5" />}
                variant="danger"
                className="py-2"
              />
              <ModernStatCard
                title="Saldo Devedor"
                value={`R$ ${totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                icon={<AlertCircle className="h-5 w-5" />}
                variant="info"
                className="py-2"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Tabs */}
        <Tabs defaultValue="manage" className="space-y-4">
          <TabsList className="h-9">
            <TabsTrigger value="manage" className="text-xs">Cobranças</TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs">Canceladas</TabsTrigger>
            <TabsTrigger value="protested" className="text-xs">
              <Scale className="h-3 w-3 mr-1" />
              Protestos
            </TabsTrigger>
            <TabsTrigger value="cpf-lookup" className="text-xs">Consultar CPF</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="manage" className="space-y-4">
            {/* Painel de Inadimplência Crítica */}
            <CriticalDelinquencyPanel />
            
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
                  className="pl-8 pr-8 h-9"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
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
                  <SelectItem value="upcoming_7days">Próximos 7 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabela com Skeleton */}
            {loading ? (
              <BillingTableSkeleton rows={8} />
            ) : error ? (
              <div className="rounded-lg border bg-card p-12">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-3 rounded-full bg-destructive/10">
                    <WifiOff className="w-6 h-6 text-destructive" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-foreground">Erro ao carregar</p>
                    <p className="text-sm text-muted-foreground mt-1">{error}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => loadPayments()}
                    className="gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Tentar novamente
                  </Button>
                </div>
              </div>
            ) : (
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
                  {paginatedPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma cobrança encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedPayments.map((payment) => (
                      <TableRow key={payment.id} className="group/row hover:bg-muted/30">
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
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-1 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                {getPageNumbers().map(page => (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "outline"}
                    size="sm"
                    className="w-9 px-0"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próximo
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-4">
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold">Cliente</TableHead>
                    <TableHead className="font-semibold text-right">Valor</TableHead>
                    <TableHead className="font-semibold">Motivo</TableHead>
                    <TableHead className="font-semibold">Cancelado em</TableHead>
                    <TableHead className="font-semibold text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.filter(p => p.status === 'cancelled').length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhuma cobrança cancelada
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.filter(p => p.status === 'cancelled').map((payment) => (
                      <TableRow key={payment.id} className="group/row hover:bg-muted/30">
                        <TableCell className="font-medium">
                          {payment.clients?.name || 'Sistema'}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate" title={(payment as any).cancellation_reason || ''}>
                          {(payment as any).cancellation_reason || <span className="text-muted-foreground/50 italic">Não informado</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {(payment as any).cancelled_at ? formatDateBR((payment as any).cancelled_at) : formatDateBR(payment.updated_at)}
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

          <TabsContent value="protested">
            <Suspense fallback={
              <div className="space-y-4">
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-lg" />
                  ))}
                </div>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-64 rounded-lg" />
              </div>
            }>
              <ProtestedPaymentsTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="cpf-lookup">
            <CpfLookup />
          </TabsContent>

          <TabsContent value="history">
            <Suspense fallback={
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-9 w-32" />
                </div>
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                  ))}
                </div>
                <Skeleton className="h-64 rounded-lg" />
              </div>
            }>
              <BillingHistory />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

export default BillingPage
