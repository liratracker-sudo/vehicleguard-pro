import { AppLayout } from "@/components/layout/AppLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateBR } from "@/lib/timezone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  CreditCard,
  PiggyBank,
  BarChart3,
  Download,
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { useFinancialData } from "@/hooks/useFinancialData"

const FinancialPage = () => {
  const { 
    summary, 
    accountsByGateway, 
    transactions, 
    monthlyData, 
    cashFlowData, 
    isLoading 
  } = useFinancialData()

  const getTransactionBadge = (type: string) => {
    return type === 'receita' ? (
      <Badge className="bg-success/20 text-success border-success/30">Receita</Badge>
    ) : (
      <Badge className="bg-destructive/20 text-destructive border-destructive/30">Despesa</Badge>
    )
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Carregando dados financeiros...</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Financeiro</h1>
            <p className="text-muted-foreground">
              Fluxo de caixa, contas e análise financeira completa
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Transação
            </Button>
          </div>
        </div>

        {/* Financial Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {summary.totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Total recebido
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                R$ {summary.monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Mês atual
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Despesas Mensais</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                R$ {summary.monthlyExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Mês atual
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {summary.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.monthlyRevenue > 0 
                  ? `Margem de ${((summary.netProfit / summary.monthlyRevenue) * 100).toFixed(1)}%`
                  : 'Sem receitas este mês'
                }
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
            <TabsTrigger value="accounts">Contas</TabsTrigger>
            <TabsTrigger value="transactions">Transações</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Receita vs Despesas (6 meses)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                      <YAxis 
                        className="text-xs fill-muted-foreground"
                        tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px'
                        }}
                      />
                      <Bar dataKey="receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Evolução do Lucro</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                      <YAxis 
                        className="text-xs fill-muted-foreground"
                        tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Lucro']}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="lucro" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3}
                        dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cashflow" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Fluxo de Caixa Diário</CardTitle>
                <CardDescription>
                  Acompanhe entradas e saídas de caixa em tempo real
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={cashFlowData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs fill-muted-foreground" />
                    <YAxis 
                      className="text-xs fill-muted-foreground"
                      tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                    />
                    <Bar dataKey="entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounts" className="space-y-6">
            {accountsByGateway.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <PiggyBank className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Nenhum pagamento recebido ainda. As contas por gateway aparecerão aqui quando houver transações.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {accountsByGateway.map((account) => (
                  <Card key={account.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{account.name}</CardTitle>
                      <CardDescription>{account.bank}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold mb-2">
                        R$ {account.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <Badge variant="outline" className="mb-4">
                        {account.type}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transactions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Transações Recentes</CardTitle>
                <CardDescription>
                  Histórico detalhado de movimentações financeiras
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-6">
                  <Button variant="outline">
                    <Filter className="w-4 h-4 mr-2" />
                    Filtros
                  </Button>
                  <Button variant="outline">
                    <Calendar className="w-4 h-4 mr-2" />
                    Período
                  </Button>
                </div>

                {transactions.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-muted-foreground">
                      Nenhuma transação encontrada. As transações aparecerão aqui quando houver receitas ou despesas.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>{getTransactionBadge(transaction.type)}</TableCell>
                            <TableCell>{transaction.description}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{transaction.category}</Badge>
                            </TableCell>
                            <TableCell>
                              {formatDateBR(transaction.date)}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${
                              transaction.type === 'receita' ? 'text-success' : 'text-destructive'
                            }`}>
                              {transaction.type === 'receita' ? '+' : '-'}
                              R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Relatórios Disponíveis</CardTitle>
                  <CardDescription>
                    Gere relatórios financeiros detalhados
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="outline" className="w-full justify-start">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Demonstrativo de Resultados (DRE)
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Fluxo de Caixa Detalhado
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <PiggyBank className="w-4 h-4 mr-2" />
                    Balanço Patrimonial
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="w-4 h-4 mr-2" />
                    Relatório Mensal
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Configurações</CardTitle>
                  <CardDescription>
                    Configure integrações bancárias
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="outline" className="w-full justify-start">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Configurar Open Banking
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Sincronizar Contas
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Download className="w-4 h-4 mr-2" />
                    Backup de Dados
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

export default FinancialPage