import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, FileText, Download, Send, Search, Filter, MoreHorizontal, Edit, Trash, Eye, FileSearch, RefreshCw } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ContractForm } from "@/components/contracts/ContractForm"
import { ContractTemplates } from "@/components/contracts/ContractTemplates"
import { AssinafyLogsDialog } from "@/components/contracts/AssinafyLogsDialog"
import { useContracts } from "@/hooks/useContracts"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

const ContractsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const clientIdFilter = searchParams.get('client_id')
  
  const [searchTerm, setSearchTerm] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingContract, setEditingContract] = useState<string | null>(null)
  const [showLogs, setShowLogs] = useState(false)
  const [selectedContractForLogs, setSelectedContractForLogs] = useState<string | undefined>()
  const [syncingStatus, setSyncingStatus] = useState<string | null>(null)
  
  const { contracts, loading, deleteContract, sendForSignature, loadContracts } = useContracts()

  const clearClientFilter = () => {
    setSearchParams({})
  }

  const filteredClientName = clientIdFilter 
    ? contracts.find(c => c.client_id === clientIdFilter)?.clients?.name 
    : null

  const filteredContracts = contracts.filter(contract => {
    const matchesClient = !clientIdFilter || contract.client_id === clientIdFilter
    const matchesSearch = 
      contract.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.plans?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.vehicles?.license_plate?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesClient && matchesSearch
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/20 text-success border-success/30">Ativo</Badge>
      case 'expired':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Vencido</Badge>
      case 'suspended':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Suspenso</Badge>
      default:
        return <Badge variant="outline">Desconhecido</Badge>
    }
  }

  const getSignatureBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pendente</Badge>
      case 'sent':
        return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">Enviado</Badge>
      case 'signed':
        return <Badge className="bg-success/20 text-success border-success/30">Assinado</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const [downloadingDocument, setDownloadingDocument] = useState<string | null>(null)

  const handleViewDocument = async (contract: any) => {
    // Se não tem ID do documento no Assinafy, não pode visualizar
    if (!contract.assinafy_document_id) {
      toast.error('Documento não disponível no Assinafy')
      return
    }

    // Se ainda não foi assinado, abrir página de assinatura pública
    if (contract.signature_status !== 'signed') {
      window.open(`https://app.assinafy.com.br/sign/${contract.assinafy_document_id}`, '_blank')
      return
    }

    // Abrir janela ANTES do async para evitar bloqueio de popup
    const newWindow = window.open('about:blank', '_blank')
    if (!newWindow) {
      toast.error('Popup bloqueado. Permita popups para este site.')
      return
    }

    // Mostrar loading na janela
    newWindow.document.write(`
      <html>
        <head><title>Carregando documento...</title></head>
        <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f5f5f5;">
          <div style="text-align:center;">
            <p style="font-size:18px;color:#333;">Carregando documento...</p>
            <p style="font-size:14px;color:#666;">Aguarde um momento</p>
          </div>
        </body>
      </html>
    `)

    // Se foi assinado, baixar via edge function (proxy autenticado)
    setDownloadingDocument(contract.id)
    try {
      const { data, error } = await supabase.functions.invoke('assinafy-integration', {
        body: { 
          action: 'downloadDocument', 
          document_id: contract.assinafy_document_id 
        }
      })

      if (error) throw error

      if (data?.pdfBase64) {
        // Converter base64 para blob e redirecionar janela
        const byteCharacters = atob(data.pdfBase64)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        newWindow.location.href = url
      } else {
        newWindow.close()
        throw new Error('PDF não retornado')
      }
    } catch (error: any) {
      console.error('Erro ao baixar documento:', error)
      newWindow.close()
      toast.error('Erro ao abrir documento assinado')
    } finally {
      setDownloadingDocument(null)
    }
  }

  const handleEdit = (contractId: string) => {
    setEditingContract(contractId)
    setShowForm(true)
  }

  const handleDelete = async (contractId: string) => {
    if (!confirm('Tem certeza que deseja excluir este contrato?')) return
    await deleteContract(contractId)
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditingContract(null)
    loadContracts()
  }

  const handleSyncStatus = async (contract: any) => {
    if (!contract.assinafy_document_id) {
      toast.error('Este contrato não possui ID de documento Assinafy')
      return
    }

    setSyncingStatus(contract.id)
    
    try {
      const { data, error } = await supabase.functions.invoke('assinafy-integration', {
        body: {
          action: 'syncStatus',
          documentId: contract.assinafy_document_id
        }
      })

      if (error) throw error

      if (data?.success) {
        toast.success(`Status atualizado: ${data.status === 'signed' ? 'Assinado' : 'Pendente'}`)
        loadContracts()
      } else {
        toast.error(data?.error || 'Erro ao sincronizar status')
      }
    } catch (error: any) {
      console.error('Erro ao sincronizar:', error)
      toast.error('Erro ao sincronizar status do documento')
    } finally {
      setSyncingStatus(null)
    }
  }

  const stats = {
    active: contracts.filter(c => c.status === 'active').length,
    pending: contracts.filter(c => c.signature_status === 'pending' || c.signature_status === 'sent').length,
    expiring: contracts.filter(c => {
      if (!c.end_date) return false
      const endDate = new Date(c.end_date)
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
      return endDate <= thirtyDaysFromNow && endDate > new Date()
    }).length
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Contratos</h1>
            <p className="text-muted-foreground">
              Gestão de contratos digitais e assinaturas eletrônicas
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              setSelectedContractForLogs(undefined);
              setShowLogs(true);
            }}>
              <FileSearch className="w-4 h-4 mr-2" />
              Ver Logs
            </Button>
            <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button onClick={() => {setEditingContract(null); setShowForm(true)}}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Contrato
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogTitle>
                  {editingContract ? 'Editar Contrato' : 'Novo Contrato'}
                </DialogTitle>
                <ContractForm
                  contractId={editingContract || undefined}
                  onSuccess={handleFormSuccess}
                  onCancel={() => setShowForm(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contratos Ativos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
              <p className="text-xs text-muted-foreground">Contratos vigentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes Assinatura</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Aguardando cliente</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencimentos</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.expiring}</div>
              <p className="text-xs text-muted-foreground">Próximos 30 dias</p>
            </CardContent>
          </Card>
        </div>

        <ContractTemplates />

        <Card>
          <CardHeader>
            <CardTitle>Lista de Contratos</CardTitle>
            <CardDescription>
              Visualize e gerencie todos os contratos digitais
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clientIdFilter && (
              <div className="flex items-center gap-2 mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm">
                  Filtrando contratos de: <strong>{filteredClientName || 'Cliente'}</strong>
                </span>
                <Button variant="ghost" size="sm" onClick={clearClientFilter} className="ml-auto">
                  Limpar filtro
                </Button>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente, plano ou veículo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filtros
              </Button>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Cliente</TableHead>
                    <TableHead className="min-w-[150px]">Plano/Veículo</TableHead>
                    <TableHead className="min-w-[100px]">Valor</TableHead>
                    <TableHead className="min-w-[150px]">Vigência</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[120px]">Assinatura</TableHead>
                    <TableHead className="w-[70px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredContracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Nenhum contrato encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContracts.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{contract.clients?.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {contract.clients?.phone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{contract.plans?.name}</div>
                            {contract.contract_vehicles && contract.contract_vehicles.length > 0 ? (
                              <div className="text-sm text-muted-foreground">
                                {contract.contract_vehicles.length === 1 
                                  ? contract.contract_vehicles[0].license_plate
                                  : `${contract.contract_vehicles.length} veículos`
                                }
                              </div>
                            ) : contract.vehicles && (
                              <div className="text-sm text-muted-foreground">
                                {contract.vehicles.license_plate}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>R$ {contract.monthly_value.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(contract.start_date).toLocaleDateString()}
                            {contract.end_date && (
                              <>
                                <br />
                                <span className="text-muted-foreground">
                                  até {new Date(contract.end_date).toLocaleDateString()}
                                </span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(contract.status)}</TableCell>
                        <TableCell>{getSignatureBadge(contract.signature_status)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleViewDocument(contract)}>
                                <Eye className="mr-2 h-4 w-4" />
                                {contract.signature_status === 'signed' ? 'Ver documento' : 'Acessar para assinar'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedContractForLogs(contract.id);
                                setShowLogs(true);
                              }}>
                                <FileSearch className="mr-2 h-4 w-4" />
                                Ver logs
                              </DropdownMenuItem>
                              {contract.assinafy_document_id && (
                                <DropdownMenuItem 
                                  onClick={() => handleSyncStatus(contract)}
                                  disabled={syncingStatus === contract.id}
                                >
                                  <RefreshCw className={`mr-2 h-4 w-4 ${syncingStatus === contract.id ? 'animate-spin' : ''}`} />
                                  {syncingStatus === contract.id ? 'Sincronizando...' : 'Sincronizar status'}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleEdit(contract.id)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              {(contract.signature_status === 'pending' || contract.signature_status === 'cancelled') && (
                                <DropdownMenuItem onClick={() => sendForSignature(contract.id)}>
                                  <Send className="mr-2 h-4 w-4" />
                                  Enviar para assinatura
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => handleDelete(contract.id)}
                                className="text-destructive"
                              >
                                <Trash className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
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

      <AssinafyLogsDialog 
        open={showLogs} 
        onOpenChange={setShowLogs}
        contractId={selectedContractForLogs}
      />
    </AppLayout>
  )
}

export default ContractsPage