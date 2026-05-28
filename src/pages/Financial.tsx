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
import { Progress } from "@/components/ui/progress"
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  BarChart3,
  Download,
  FileText,
  Loader2,
  ArrowRight,
  Wallet
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
import { useFinancialData, type PeriodRange } from "@/hooks/useFinancialData"
import { useReportData } from "@/hooks/useReportData"
import { DREReport } from "@/components/reports/DREReport"
import { CashFlowReport } from "@/components/reports/CashFlowReport"
import { BalanceSheetReport } from "@/components/reports/BalanceSheetReport"
import { MonthlyReport } from "@/components/reports/MonthlyReport"
import { PeriodSelector } from "@/components/financial/PeriodSelector"
import { TransactionDrilldownSheet, type DrilldownRow } from "@/components/financial/TransactionDrilldownSheet"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import html2pdf from "html2pdf.js"

type ReportType = 'dre' | 'cashflow' | 'balance' | 'monthly' | null

const FinancialPage = () => {
  const [selectedReport, setSelectedReport] = useState<ReportType>(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [isExporting, setIsExporting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  const [period, setPeriod] = useState<PeriodRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  })

  const [drilldown, setDrilldown] = useState<{ title: string; description?: string; rows: DrilldownRow[]; labelColumn: string } | null>(null)

  const {
    summary,
    accountsByGateway,
    gatewayTransactions,
    expensesByCategory,
    expensesByCategoryItems,
    transactions,
    monthlyData,
    cashFlowData,
    isLoading
  } = useFinancialData(period)

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

  const openGatewayDrilldown = (gatewayId: string, gatewayName: string) => {
    const items = gatewayTransactions[gatewayId] || []
    setDrilldown({
      title: `Recebimentos — ${gatewayName}`,
      description: `Lista detalhada dos pagamentos confirmados no período. Use para conferir contra o extrato do gateway.`,
      labelColumn: "Cliente",
      rows: items.map(i => ({ id: i.id, date: i.date, label: i.clientName, amount: i.amount })),
    })
  }

  const openCategoryDrilldown = (category: string) => {
    const items = expensesByCategoryItems[category] || []
    setDrilldown({
      title: `Saídas — ${category}`,
      description: `Despesas pagas no período nesta categoria.`,
      labelColumn: "Descrição",
      rows: items.map(i => ({ id: i.id, date: i.date, label: i.description, amount: i.amount })),
    })
  }

  const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`
  const periodLabel = `${format(period.from, "dd/MM", { locale: ptBR })} a ${format(period.to, "dd/MM", { locale: ptBR })}`

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
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Financeiro</h1>
            <p className="text-muted-foreground">
              Recebimentos por gateway, saídas por categoria — regime de caixa ({periodLabel})
            </p>
          </div>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>

        {/* Period KPIs (cash basis) */}
        <div className="grid gap-4 md:grid-cols-4">
          <ModernStatCard
            title="Total Recebido"
            value={`R$ ${summary.monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<TrendingUp className="h-6 w-6" />}
            description={`${fmtPct(summary.revenueDelta)} vs período anterior`}
            variant="success"
          />
          <ModernStatCard
            title="Total Pago"
            value={`R$ ${summary.monthlyExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<TrendingDown className="h-6 w-6" />}
            description={`${fmtPct(summary.expenseDelta)} vs período anterior`}
            variant="danger"
          />
          <ModernStatCard
            title="Saldo Líquido"
            value={`R$ ${summary.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<BarChart3 className="h-6 w-6" />}
            description={summary.monthlyRevenue > 0
              ? `Margem ${((summary.netProfit / summary.monthlyRevenue) * 100).toFixed(1)}%`
              : 'Sem receitas no período'}
            variant={summary.netProfit >= 0 ? 'success' : 'danger'}
          />
          <ModernStatCard
            title="Ticket Médio"
            value={`R$ ${summary.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<Wallet className="h-6 w-6" />}
            description={`${summary.txCount} ${summary.txCount === 1 ? 'recebimento' : 'recebimentos'}`}
            variant="info"
          />
        </div>

        {/* Recebimentos por Gateway */}
        <Card>
          <CardHeader>
            <CardTitle>Recebimentos por Gateway</CardTitle>
            <CardDescription>
              Quanto entrou em cada conta no período. Clique para ver as transações e conferir contra o extrato.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accountsByGateway.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhum recebimento no período selecionado.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {accountsByGateway.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => openGatewayDrilldown(acc.id, acc.name)}
                    className="group text-left rounded-lg border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold text-foreground">{acc.name}</div>
                        <div className="text-xs text-muted-foreground">{acc.type}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-2xl font-bold text-success mb-2">
                      R$ {acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="space-y-1.5">
                      <Progress value={acc.pctOfTotal} className="h-1.5" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{acc.pctOfTotal.toFixed(1)}% do total</span>
                        <span>Médio R$ {acc.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Saídas por Categoria */}
        <Card>
          <CardHeader>
            <CardTitle>Saídas por Categoria</CardTitle>
            <CardDescription>
              Despesas pagas no período agrupadas por categoria. Clique para detalhar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhuma despesa paga no período.
              </div>
            ) : (
              <div className="space-y-2">
                {expensesByCategory.map((cat) => (
                  <button
                    key={cat.category}
                    onClick={() => openCategoryDrilldown(cat.category)}
                    className="group w-full text-left rounded-lg border bg-card p-3 hover:border-primary/50 transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{cat.category}</span>
                        <Badge variant="outline" className="text-xs">{cat.count}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-destructive">
                          R$ {cat.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={cat.pctOfTotal} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground w-12 text-right">{cat.pctOfTotal.toFixed(1)}%</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>


        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Tendência (6 meses)</TabsTrigger>
            <TabsTrigger value="cashflow">Fluxo Diário</TabsTrigger>
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
