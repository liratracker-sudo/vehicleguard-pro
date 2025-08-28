import { useState } from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  CreditCard, 
  DollarSign, 
  AlertCircle, 
  Download, 
  Send, 
  QrCode,
  FileText,
  Calendar,
  Search,
  Filter,
  Plus
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const invoices = [
  {
    id: "INV-2024-001",
    clientName: "Maria Santos Silva",
    clientId: 1,
    amount: 149.90,
    dueDate: "2024-02-15",
    status: "paid",
    paymentMethod: "pix",
    paidAt: "2024-02-13T10:30:00Z",
    description: "Plano Premium - Fev/2024"
  },
  {
    id: "INV-2024-002",
    clientName: "João Oliveira Costa",
    clientId: 2,
    amount: 89.90,
    dueDate: "2024-02-14",
    status: "pending",
    paymentMethod: null,
    paidAt: null,
    description: "Plano Básico - Fev/2024"
  },
  {
    id: "INV-2024-003",
    clientName: "Ana Costa Ferreira",
    clientId: 3,
    amount: 149.90,
    dueDate: "2024-01-10",
    status: "overdue",
    paymentMethod: null,
    paidAt: null,
    description: "Plano Premium - Jan/2024"
  },
  {
    id: "INV-2024-004",
    clientName: "Carlos Silva Mendes",
    clientId: 4,
    amount: 1200.00,
    dueDate: "2024-02-12",
    status: "paid",
    paymentMethod: "bank_transfer",
    paidAt: "2024-02-10T15:45:00Z",
    description: "Plano Empresarial - Fev/2024"
  }
]

const paymentMethods = [
  { id: "pix", name: "PIX", icon: QrCode },
  { id: "boleto", name: "Boleto", icon: FileText },
  { id: "credit_card", name: "Cartão de Crédito", icon: CreditCard },
  { id: "bank_transfer", name: "Transferência", icon: DollarSign }
]

const BillingPage = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-success/20 text-success border-success/30">Pago</Badge>
      case 'pending':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Pendente</Badge>
      case 'overdue':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Vencido</Badge>
      case 'cancelled':
        return <Badge variant="outline">Cancelado</Badge>
      default:
        return <Badge variant="outline">Desconhecido</Badge>
    }
  }

  const getPaymentMethodBadge = (method: string | null) => {
    if (!method) return <span className="text-muted-foreground">-</span>
    
    const paymentMethod = paymentMethods.find(pm => pm.id === method)
    return paymentMethod ? (
      <Badge variant="outline" className="gap-1">
        <paymentMethod.icon className="w-3 h-3" />
        {paymentMethod.name}
      </Badge>
    ) : <span className="text-muted-foreground">-</span>
  }

  const totalReceived = invoices.filter(inv => inv.status === 'paid')
                               .reduce((sum, inv) => sum + inv.amount, 0)
  const totalPending = invoices.filter(inv => inv.status === 'pending')
                              .reduce((sum, inv) => sum + inv.amount, 0)
  const totalOverdue = invoices.filter(inv => inv.status === 'overdue')
                              .reduce((sum, inv) => sum + inv.amount, 0)

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Cobrança</h1>
            <p className="text-muted-foreground">
              Gerencie boletos, PIX, links de pagamento e inadimplência
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Cobrança
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
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
                {invoices.filter(inv => inv.status === 'paid').length} faturas pagas
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
                {invoices.filter(inv => inv.status === 'pending').length} faturas pendentes
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
                {invoices.filter(inv => inv.status === 'overdue').length} faturas vencidas
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Inadimplência</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {((totalOverdue / (totalReceived + totalPending + totalOverdue)) * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Do total faturado
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Methods and Invoices */}
        <Tabs defaultValue="invoices" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="invoices">Faturas</TabsTrigger>
            <TabsTrigger value="payment-methods">Métodos de Pagamento</TabsTrigger>
            <TabsTrigger value="overdue">Inadimplência</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Faturas</CardTitle>
                <CardDescription>
                  Todas as faturas emitidas e seus status de pagamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por cliente ou fatura..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="overdue">Vencido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fatura</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{invoice.id}</div>
                              <div className="text-sm text-muted-foreground">
                                {invoice.description}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{invoice.clientName}</TableCell>
                          <TableCell>
                            R$ {invoice.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            {new Date(invoice.dueDate).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                          <TableCell>{getPaymentMethodBadge(invoice.paymentMethod)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm">
                                <Send className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment-methods" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {paymentMethods.map((method) => (
                <Card key={method.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <method.icon className="w-5 h-5" />
                      {method.name}
                    </CardTitle>
                    <CardDescription>
                      Configurações e integrações para {method.name.toLowerCase()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Status:</span>
                      <Badge className="bg-success/20 text-success border-success/30">
                        Ativo
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Taxa:</span>
                      <span className="text-sm font-medium">2.5%</span>
                    </div>
                    <Button variant="outline" className="w-full">
                      Configurar
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="overdue" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  Gestão de Inadimplência
                </CardTitle>
                <CardDescription>
                  Ferramentas para recuperação de crédito e gestão de inadimplentes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-destructive">
                        {invoices.filter(inv => inv.status === 'overdue').length}
                      </div>
                      <p className="text-sm text-muted-foreground">Clientes inadimplentes</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <p className="text-sm text-muted-foreground">Valor em atraso</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        15 dias
                      </div>
                      <p className="text-sm text-muted-foreground">Atraso médio</p>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="flex gap-4">
                  <Button>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Lembretes
                  </Button>
                  <Button variant="outline">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Suspender Serviços
                  </Button>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Relatório de Inadimplência
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Relatórios Financeiros</CardTitle>
                <CardDescription>
                  Gere relatórios detalhados sobre cobrança e recebimentos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Button variant="outline" className="h-24 flex-col gap-2">
                    <FileText className="w-6 h-6" />
                    Relatório Mensal
                  </Button>
                  <Button variant="outline" className="h-24 flex-col gap-2">
                    <Download className="w-6 h-6" />
                    Extrato de Recebimentos
                  </Button>
                  <Button variant="outline" className="h-24 flex-col gap-2">
                    <AlertCircle className="w-6 h-6" />
                    Análise de Inadimplência
                  </Button>
                  <Button variant="outline" className="h-24 flex-col gap-2">
                    <DollarSign className="w-6 h-6" />
                    Fluxo de Caixa
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

export default BillingPage