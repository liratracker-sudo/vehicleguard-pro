import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, DollarSign, AlertCircle, Calendar, RefreshCw, Zap, Settings } from "lucide-react"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { BillingHistory } from "@/components/billing/BillingHistory"
import { PaymentForm } from "@/components/billing/PaymentForm"
import { BillingActions } from "@/components/billing/BillingActions"
import { BillingFilters, BillingFiltersState } from "@/components/billing/BillingFilters"
import { usePayments } from "@/hooks/usePayments"
import { useBillingManagement } from "@/hooks/useBillingManagement"
import { AsaasCpfLookup } from "@/components/billing/AsaasCpfLookup"
import { AsaasStatusIndicator } from "@/components/billing/AsaasStatusIndicator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const BillingPage = () => {
  const navigate = useNavigate()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [filters, setFilters] = useState<BillingFiltersState>({
    search: "",
    status: "all",
    gateway: "all",
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
      status: "all",
      gateway: "all",
      dateFrom: undefined,
      dateTo: undefined,
      amountMin: "",
      amountMax: ""
    })
  }

  const filteredPayments = payments.filter(payment => {
    // Exclude cancelled payments (deleted charges should not be visible)
    if (payment.status === 'cancelled') {
      return false
    }

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
    if (filters.status && filters.status !== "all" && payment.status !== filters.status) {
      return false
    }

    // Gateway filter
    if (filters.gateway && filters.gateway !== "all" && payment.payment_gateway !== filters.gateway) {
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
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestão de Cobranças</h1>
            <p className="text-muted-foreground">
              Controle completo de cobranças automáticas, notificações e inadimplência
            </p>
          </div>
          
          {/* Navigation buttons - responsive layout with proper spacing */}
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Button 
              variant="secondary" 
              onClick={() => navigate('/settings?tab=billing')}
              className="flex-shrink-0"
            >
              <Settings className="w-4 h-4 sm:mr-2" />
              <span className="hidden xs:inline ml-1">Config. Notificações</span>
              <span className="xs:hidden">Config</span>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={loadPayments}
              disabled={loading}
              className="flex-shrink-0"
            >
              <RefreshCw className={`w-4 h-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline ml-1">Atualizar</span>
            </Button>
            
            <Button 
              variant="outline"
              onClick={handleGenerateCharges}
              disabled={managementLoading}
              className="flex-shrink-0"
            >
              <Zap className="w-4 h-4 sm:mr-2" />
              <span className="hidden xs:inline ml-1">Gerar Cobranças</span>
            </Button>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex-shrink-0">
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden xs:inline ml-1">Nova Cobrança</span>
                  <span className="xs:hidden">Nova</span>
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Recebido</CardTitle>
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-success/20">
                <DollarSign className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-success leading-none mb-2">
                R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                {payments.filter(p => p.status === 'paid').length} pagamentos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Pendente</CardTitle>
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-warning/20">
                <Calendar className="h-4 w-4 text-warning" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-warning leading-none mb-2">
                R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                {payments.filter(p => p.status === 'pending').length} pendentes
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Vencido</CardTitle>
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-destructive/20">
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-destructive leading-none mb-2">
                R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                {payments.filter(p => p.status === 'overdue').length} vencidas
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Saldo Devedor</CardTitle>
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
                <AlertCircle className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-primary leading-none mb-2">
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
            <TabsTrigger value="cancelled">Cobranças Canceladas</TabsTrigger>
            <TabsTrigger value="cpf-lookup">Consultar por CPF</TabsTrigger>
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
                <div className="flex gap-4 items-start">
                  <div className="flex-1">
                    <BillingFilters 
                      filters={filters}
                      onFiltersChange={setFilters}
                      onClearFilters={clearFilters}
                    />
                  </div>
                  <div className="w-80">
                    <AsaasStatusIndicator />
                  </div>
                </div>
                
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

          <TabsContent value="cancelled" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cobranças Canceladas</CardTitle>
                <CardDescription>
                  Visualize e exclua permanentemente cobranças canceladas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-sm text-muted-foreground">
                  Exibindo {payments.filter(p => p.status === 'cancelled').length} cobranças canceladas
                </div>

                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Cliente/ID</TableHead>
                        <TableHead className="min-w-[100px]">Tipo</TableHead>
                        <TableHead className="min-w-[100px]">Valor</TableHead>
                        <TableHead className="min-w-[120px]">Cancelado em</TableHead>
                        <TableHead className="min-w-[120px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.filter(p => p.status === 'cancelled').length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            Nenhuma cobrança cancelada encontrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        payments.filter(p => p.status === 'cancelled').map((payment) => (
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
                              <div className="text-sm">
                                {new Date(payment.updated_at).toLocaleDateString('pt-BR')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(payment.updated_at).toLocaleTimeString('pt-BR')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <BillingActions 
                                payment={payment} 
                                onUpdate={() => {
                                  loadPayments()
                                  loadCompanyBalance()
                                }}
                                showDeletePermanently={true}
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

          <TabsContent value="cpf-lookup">
            <AsaasCpfLookup />
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