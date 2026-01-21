import { useState, useRef } from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Download, FileText, BarChart3, Users, Loader2, FileSpreadsheet, AlertTriangle } from "lucide-react"
import { useClients } from "@/hooks/useClients"
import { usePayments } from "@/hooks/usePayments"
import { useMissingCharges } from "@/hooks/useMissingCharges"
import { ClientsReport } from "@/components/reports/ClientsReport"
import { DelinquencyReport } from "@/components/reports/DelinquencyReport"
import { MissingChargesReport } from "@/components/reports/MissingChargesReport"
import { toast } from "sonner"
import html2pdf from "html2pdf.js"
import { differenceInDays, parseISO } from "date-fns"

const ReportsPage = () => {
  const { clients, loading: loadingClients } = useClients()
  const { payments, loading: loadingPayments } = usePayments()
  const { 
    clients: missingChargesClients, 
    companySummary,
    loading: loadingMissing,
    totalEstimatedValue,
    totalVehicles,
    clientsWithoutContract
  } = useMissingCharges()
  
  const [selectedReport, setSelectedReport] = useState<'clients' | 'financial' | 'delinquency' | 'missingCharges' | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  
  const clientsReportRef = useRef<HTMLDivElement>(null)
  const delinquencyReportRef = useRef<HTMLDivElement>(null)
  const missingChargesReportRef = useRef<HTMLDivElement>(null)

  // Calculate overdue payments
  const overduePayments = payments
    .filter(p => p.status === 'pending' && p.due_date && new Date(p.due_date) < new Date())
    .map(p => ({
      id: p.id,
      client_name: p.clients?.name || 'Cliente não identificado',
      amount: p.amount,
      due_date: p.due_date!,
      days_overdue: differenceInDays(new Date(), parseISO(p.due_date!))
    }))

  const handleExportPDF = async (reportType: 'clients' | 'delinquency' | 'missingCharges') => {
    let ref: HTMLDivElement | null = null;
    let filename = '';

    switch (reportType) {
      case 'clients':
        ref = clientsReportRef.current;
        filename = 'clientes';
        break;
      case 'delinquency':
        ref = delinquencyReportRef.current;
        filename = 'inadimplencia';
        break;
      case 'missingCharges':
        ref = missingChargesReportRef.current;
        filename = 'auditoria-sem-cobranca';
        break;
    }

    if (!ref) return

    setIsExporting(true)
    try {
      const opt = {
        margin: 10,
        filename: `relatorio-${filename}-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: reportType === 'missingCharges' ? 'landscape' as const : 'portrait' as const }
      }

      await html2pdf().set(opt).from(ref).save()
      toast.success('PDF exportado com sucesso!')
    } catch (error) {
      console.error('Erro ao exportar PDF:', error)
      toast.error('Erro ao exportar PDF')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportExcel = () => {
    setIsExporting(true)
    try {
      // Create CSV content
      const headers = ['Data', 'Descrição', 'Cliente', 'Tipo', 'Valor', 'Status', 'Gateway']
      const rows = payments.map(p => [
        p.due_date || p.created_at?.split('T')[0] || '',
        'Cobrança',
        p.clients?.name || '-',
        p.transaction_type === 'income' ? 'Receita' : 'Despesa',
        p.amount.toFixed(2).replace('.', ','),
        p.status === 'paid' ? 'Pago' : p.status === 'pending' ? 'Pendente' : p.status,
        p.payment_gateway || '-'
      ])

      // Add totals
      const totalReceived = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)
      const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0)
      
      rows.push([])
      rows.push(['', '', '', '', '', '', ''])
      rows.push(['RESUMO', '', '', '', '', '', ''])
      rows.push(['Total Recebido', '', '', '', totalReceived.toFixed(2).replace('.', ','), '', ''])
      rows.push(['Total Pendente', '', '', '', totalPending.toFixed(2).replace('.', ','), '', ''])

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(';'))
        .join('\n')

      // Add BOM for Excel to recognize UTF-8
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `relatorio-financeiro-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      URL.revokeObjectURL(link.href)

      toast.success('Excel exportado com sucesso!')
    } catch (error) {
      console.error('Erro ao exportar Excel:', error)
      toast.error('Erro ao exportar Excel')
    } finally {
      setIsExporting(false)
    }
  }

  const getReportTitle = () => {
    switch (selectedReport) {
      case 'clients': return 'Relatório de Clientes'
      case 'delinquency': return 'Relatório de Inadimplência'
      case 'missingCharges': return 'Auditoria - Clientes Sem Cobrança'
      default: return ''
    }
  }

  const isLoading = loadingClients || loadingPayments || loadingMissing

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
            <p className="text-muted-foreground">
              Relatórios gerenciais e exportação de dados
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Relatório de Clientes
              </CardTitle>
              <CardDescription>
                Lista completa de clientes e status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setSelectedReport('clients')}
                disabled={isLoading}
              >
                {loadingClients ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-2" />
                )}
                Visualizar PDF
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Relatório Financeiro
              </CardTitle>
              <CardDescription>
                Demonstrativo de receitas e despesas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleExportExcel}
                disabled={isLoading || isExporting}
              >
                {loadingPayments || isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                )}
                Baixar Excel
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Relatório de Inadimplência
              </CardTitle>
              <CardDescription>
                Análise de inadimplentes e atrasos ({overduePayments.length} em atraso)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setSelectedReport('delinquency')}
                disabled={isLoading}
              >
                {loadingPayments ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-2" />
                )}
                Visualizar PDF
              </Button>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="w-5 h-5" />
                Auditoria - Sem Cobrança
              </CardTitle>
              <CardDescription>
                Clientes ativos sem cobrança pendente ({missingChargesClients.length} clientes)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full border-amber-300 hover:bg-amber-100"
                onClick={() => setSelectedReport('missingCharges')}
                disabled={loadingMissing}
              >
                {loadingMissing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-2" />
                )}
                Visualizar PDF
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Report Dialog */}
      <Dialog open={selectedReport !== null && selectedReport !== 'financial'} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className={`max-h-[90vh] overflow-auto ${selectedReport === 'missingCharges' ? 'max-w-6xl' : 'max-w-4xl'}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{getReportTitle()}</span>
              <Button 
                onClick={() => handleExportPDF(selectedReport as 'clients' | 'delinquency' | 'missingCharges')}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Exportar PDF
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-auto">
            {selectedReport === 'clients' && (
              <ClientsReport ref={clientsReportRef} clients={clients} />
            )}
            {selectedReport === 'delinquency' && (
              <DelinquencyReport ref={delinquencyReportRef} overduePayments={overduePayments} />
            )}
            {selectedReport === 'missingCharges' && (
              <MissingChargesReport 
                ref={missingChargesReportRef} 
                clients={missingChargesClients}
                companySummary={companySummary}
                totalEstimatedValue={totalEstimatedValue}
                totalVehicles={totalVehicles}
                clientsWithoutContract={clientsWithoutContract}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

export default ReportsPage
