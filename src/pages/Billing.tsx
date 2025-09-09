import { useState, useEffect } from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BillingHistory } from "@/components/billing/BillingHistory"
import { Plus, DollarSign, AlertCircle, Calendar, RefreshCw, Zap } from "lucide-react"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { PaymentForm } from "@/components/billing/PaymentForm"
import { BillingActions } from "@/components/billing/BillingActions"
import { BillingFilters, BillingFiltersState } from "@/components/billing/BillingFilters"
import { usePayments } from "@/hooks/usePayments"
import { useBillingManagement } from "@/hooks/useBillingManagement"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const BillingPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [filters, setFilters] = useState<BillingFiltersState>({
    search: "",
    status: "",
    gateway: "",
    dateFrom: undefined,
    dateTo: undefined,
    amountMin: "",
    amountMax: ""
  })
  
  const { payments, loading, loadPayments } = usePayments()
  const { 
    loading: managementLoading, 
    generateAutomaticCharges,
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

  const handleGenerateCharges = async () => {
    try {
      await generateAutomaticCharges()
      await loadPayments()
      await loadCompanyBalance()
    } catch (error) {
      console.error('Error generating charges:', error)
    }
  }

  const clearFilters = () => {
    setFilters({
      search: "",
      status: "",
      gateway: "",
      dateFrom: undefined,
      dateTo: undefined,
      amountMin: "",
      amountMax: ""
    })
  }

  const filteredPayments = payments.filter(payment => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesSearch = 
        payment.clients?.name?.toLowerCase().includes(searchLower) ||
        payment.external_id?.toLowerCase().includes(searchLower) ||
        payment.id.toLowerCase().includes(searchLower)
      
      if (!matchesSearch) return false
    }

    // Status filter
    if (filters.status && payment.status !== filters.status) {
      return false
    }

    // Gateway filter
    if (filters.gateway && payment.payment_gateway !== filters.gateway) {
      return false
    }

    // Date filters
    if (filters.dateFrom) {
      const paymentDate = new Date(payment.created_at)
      if (paymentDate < filters.dateFrom) return false
    }
    
    if (filters.dateTo) {
      const paymentDate = new Date(payment.created_at)
      const dateTo = new Date(filters.dateTo)
      dateTo.setHours(23, 59, 59, 999) // End of day
      if (paymentDate > dateTo) return false
    }

    // Amount filters
    if (filters.amountMin) {
      const minAmount = parseFloat(filters.amountMin)
      if (payment.amount < minAmount) return false
    }
    
    if (filters.amountMax) {
      const maxAmount = parseFloat(filters.amountMax)
      if (payment.amount > maxAmount) return false
    }

    return true
  })

  // Use company balance if available, otherwise calculate from filtered payments
  const totalReceived = companyBalance?.total_received ?? filteredPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)
  const totalPending = companyBalance?.total_pending ?? filteredPayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0)
  const totalOverdue = companyBalance?.total_overdue ?? filteredPayments.filter(p => p.status === 'overdue').reduce((sum, p) => sum + p.amount, 0)
  const totalBalance = companyBalance?.total_balance ?? (totalPending + totalOverdue)

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestão de Cobranças</h1>
            <p className="text-muted-foreground">
              Controle completo de cobranças automáticas, notificações e inadimplência
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={loadPayments}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            
            <Button 
              variant="outline"
              onClick={handleGenerateCharges}
              disabled={managementLoading}
            >
              <Zap className="w-4 h-4 mr-2" />
              Gerar Cobranças
            </Button>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
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
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recebido</CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                {payments.filter(p => p.status === 'paid').length} pagamentos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendente</CardTitle>
              <Calendar className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                {payments.filter(p => p.status === 'pending').length} pendentes
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencido</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                {payments.filter(p => p.status === 'overdue').length} vencidas
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Devedor</CardTitle>
              <AlertCircle className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Total em aberto
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="manage" className="space-y-6">
          <TabsList>
            <TabsTrigger value="manage">Gerenciar Cobranças</TabsTrigger>
            <TabsTrigger value="history">Histórico & Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="manage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Gestão de Cobranças</CardTitle>
                <CardDescription>
                  Controle completo das cobranças com filtros avançados e ações de gestão
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <BillingFilters 
                  filters={filters}
                  onFiltersChange={setFilters}
                  onClearFilters={clearFilters}
                />
                
                <div className="text-sm text-muted-foreground">
                  Exibindo {filteredPayments.length} de {payments.length} cobranças
                </div>

                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Cliente/ID</TableHead>
                        <TableHead className="min-w-[100px]">Tipo</TableHead>
                        <TableHead className="min-w-[100px]">Valor</TableHead>
                        <TableHead className="min-w-[120px]">Vencimento</TableHead>
                        <TableHead className="min-w-[120px]">Criação</TableHead>
                        <TableHead className="min-w-[200px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : filteredPayments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            Nenhuma cobrança encontrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {payment.clients?.name || 'Sistema'}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono">
                                  {payment.id.substring(0, 8)}...
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {payment.transaction_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              {payment.due_date ? (
                                <div className="space-y-1">
                                  <div>{new Date(payment.due_date).toLocaleDateString('pt-BR')}</div>
                                  {payment.status === 'overdue' && (
                                    <div className="text-xs text-destructive">
                                      {Math.floor((Date.now() - new Date(payment.due_date).getTime()) / (1000 * 60 * 60 * 24))} dias
                                    </div>
                                  )}
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {new Date(payment.created_at).toLocaleDateString('pt-BR')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(payment.created_at).toLocaleTimeString('pt-BR')}
                              </div>
                            </TableCell>
                            <TableCell>
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
              </CardContent>
            </Card>
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