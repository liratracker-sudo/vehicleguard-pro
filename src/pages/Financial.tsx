import { useState, useRef } from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ModernStatCard } from "@/components/ui/modern-stat-card"
import { formatDateBR } from "@/lib/timezone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  FileText,
  Loader2
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
import { useReportData } from "@/hooks/useReportData"
import { DREReport } from "@/components/reports/DREReport"
import { CashFlowReport } from "@/components/reports/CashFlowReport"
import { BalanceSheetReport } from "@/components/reports/BalanceSheetReport"
import { MonthlyReport } from "@/components/reports/MonthlyReport"
import { format, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import html2pdf from "html2pdf.js"

type ReportType = 'dre' | 'cashflow' | 'balance' | 'monthly' | null

const FinancialPage = () => {
  const [selectedReport, setSelectedReport] = useState<ReportType>(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [isExporting, setIsExporting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  const { 
    summary, 
    accountsByGateway, 
    transactions, 
    monthlyData, 
    cashFlowData, 
    isLoading 
  } = useFinancialData()

  const { data: reportData, isLoading: isLoadingReport } = useReportData(selectedMonth)

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i)
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
      date
    }
  })

  const handleMonthChange = (value: string) => {
    const month = months.find(m => m.value === value)
    if (month) {
      setSelectedMonth(month.date)
    }
  }

  const handleExportPDF = async () => {
    if (!reportRef.current) return

    setIsExporting(true)
    try {
      const reportTitles: Record<string, string> = {
        dre: 'DRE',
        cashflow: 'Fluxo_de_Caixa',
        balance: 'Balanco_Patrimonial',
        monthly: 'Relatorio_Mensal'
      }

      const filename = `${reportTitles[selectedReport!]}_${format(selectedMonth, 'yyyy-MM')}.pdf`

      await html2pdf()
        .set({
          margin: 10,
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(reportRef.current)
        .save()

      toast.success('PDF exportado com sucesso!')
    } catch (error) {
      console.error('Error exporting PDF:', error)
      toast.error('Erro ao exportar PDF')
    } finally {
      setIsExporting(false)
    }
  }

  const openReport = (type: ReportType) => {
    setSelectedReport(type)
  }

  const getTransactionBadge = (type: string) => {
    return type === 'receita' ? (
      <Badge className="bg-success/20 text-success border-success/30">Receita</Badge>
    ) : (
      <Badge className="bg-destructive/20 text-destructive border-destructive/30">Despesa</Badge>
    )
  }

  const renderReportContent = () => {
    if (isLoadingReport || !reportData) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )
    }

    switch (selectedReport) {
      case 'dre':
        return <DREReport ref={reportRef} data={reportData.dre} selectedDate={selectedMonth} />
      case 'cashflow':
        return <CashFlowReport ref={reportRef} data={reportData.cashFlow} selectedDate={selectedMonth} />
      case 'balance':
        return <BalanceSheetReport ref={reportRef} data={reportData.balanceSheet} selectedDate={selectedMonth} />
      case 'monthly':
        return <MonthlyReport ref={reportRef} data={reportData.monthlyReport} selectedDate={selectedMonth} />
      default:
        return null
    }
  }

  const getReportTitle = () => {
    switch (selectedReport) {
      case 'dre':
        return 'Demonstrativo de Resultados (DRE)'
      case 'cashflow':
        return 'Fluxo de Caixa Detalhado'
      case 'balance':
        return 'Balanço Patrimonial'
      case 'monthly':
        return 'Relatório Mensal'
      default:
        return ''
    }
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
        </div>

        {/* Financial Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <ModernStatCard
            title="Saldo Total"
            value={`R$ ${summary.totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<PiggyBank className="h-6 w-6" />}
            description="Total recebido"
            variant="info"
          />
          <ModernStatCard
            title="Receita Mensal"
            value={`R$ ${summary.monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<TrendingUp className="h-6 w-6" />}
            description="Mês atual"
            variant="success"
          />
          <ModernStatCard
            title="Despesas Mensais"
            value={`R$ ${summary.monthlyExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<TrendingDown className="h-6 w-6" />}
            description="Mês atual"
            variant="danger"
          />
          <ModernStatCard
            title="Lucro Líquido"
            value={`R$ ${summary.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<BarChart3 className="h-6 w-6" />}
            description={summary.monthlyRevenue > 0 
              ? `Margem de ${((summary.netProfit / summary.monthlyRevenue) * 100).toFixed(1)}%`
              : 'Sem receitas este mês'
            }
            variant={summary.netProfit >= 0 ? 'success' : 'danger'}
          />
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
            <Card>
              <CardHeader>
                <CardTitle>Relatórios Financeiros</CardTitle>
                <CardDescription>
                  Gere relatórios detalhados com exportação em PDF
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Button 
                  variant="outline" 
                  className="h-auto py-4 justify-start"
                  onClick={() => openReport('dre')}
                >
                  <BarChart3 className="w-5 h-5 mr-3 text-primary" />
                  <div className="text-left">
                    <div className="font-medium">Demonstrativo de Resultados (DRE)</div>
                    <div className="text-xs text-muted-foreground">Receitas, despesas e lucro</div>
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto py-4 justify-start"
                  onClick={() => openReport('cashflow')}
                >
                  <TrendingUp className="w-5 h-5 mr-3 text-success" />
                  <div className="text-left">
                    <div className="font-medium">Fluxo de Caixa Detalhado</div>
                    <div className="text-xs text-muted-foreground">Entradas e saídas por categoria</div>
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto py-4 justify-start"
                  onClick={() => openReport('balance')}
                >
                  <PiggyBank className="w-5 h-5 mr-3 text-blue-500" />
                  <div className="text-left">
                    <div className="font-medium">Balanço Patrimonial</div>
                    <div className="text-xs text-muted-foreground">Ativos, passivos e patrimônio</div>
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto py-4 justify-start"
                  onClick={() => openReport('monthly')}
                >
                  <FileText className="w-5 h-5 mr-3 text-orange-500" />
                  <div className="text-left">
                    <div className="font-medium">Relatório Mensal</div>
                    <div className="text-xs text-muted-foreground">Resumo e comparativo mensal</div>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Report Dialog */}
        <Dialog open={selectedReport !== null} onOpenChange={() => setSelectedReport(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{getReportTitle()}</span>
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex items-center justify-between gap-4 py-4 border-b">
              <Select 
                value={format(selectedMonth, 'yyyy-MM')} 
                onValueChange={handleMonthChange}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={handleExportPDF} disabled={isExporting || isLoadingReport}>
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Exportar PDF
              </Button>
            </div>

            <div className="overflow-x-auto">
              {renderReportContent()}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}

export default FinancialPage
