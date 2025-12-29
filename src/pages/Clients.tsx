import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, Search, Filter, ChevronLeft, ChevronRight, Users, UserCheck, UserMinus, UserX, RefreshCw, X } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { ClientForm } from "@/components/clients/ClientForm"
import { ClientRow } from "@/components/clients/ClientRow"
import { ClientTableSkeleton } from "@/components/clients/ClientTableSkeleton"
import { useClients } from "@/hooks/useClients"
import { useClientScores } from "@/hooks/useClientScore"
import { ModernStatCard } from "@/components/ui/modern-stat-card"
import { toast } from "sonner"

const ITEMS_PER_PAGE = 15

const ClientsPage = () => {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'edit' | 'view' | null>(null)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const { clients, loading, deleteClient, toggleWhatsApp } = useClients()
  const { scores, loading: scoresLoading, recalculateAllScores } = useClientScores()

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (client.document && client.document.includes(searchTerm))
  )

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedClients = filteredClients.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const handleViewClient = (clientId: string) => {
    setSelectedClient(clientId)
    setViewMode('view')
    setIsDialogOpen(true)
  }

  const handleEditClient = (clientId: string) => {
    setSelectedClient(clientId)
    setViewMode('edit')
    setIsDialogOpen(true)
  }

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (confirm(`Tem certeza que deseja excluir o cliente "${clientName}"?`)) {
      try {
        await deleteClient(clientId)
      } catch (error) {
        // Erro já tratado no hook
      }
    }
  }

  const handleNewClient = () => {
    setSelectedClient(null)
    setViewMode(null)
    setIsDialogOpen(true)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setSelectedClient(null)
    setViewMode(null)
  }

  const handleViewContracts = (clientId: string) => {
    navigate(`/contracts?client_id=${clientId}`)
  }

  const handleViewPaymentHistory = (clientId: string) => {
    navigate(`/billing?client_id=${clientId}`)
  }

  const activeCount = clients.filter(c => c.status === 'active').length
  const suspendedCount = clients.filter(c => c.status === 'suspended').length
  const inactiveCount = clients.filter(c => c.status === 'inactive').length

  const handleRecalculateScores = async () => {
    if (clients.length === 0) return
    setIsRecalculating(true)
    try {
      await recalculateAllScores(clients.map(c => c.id))
      toast.success('Scores recalculados com sucesso!')
    } catch (error) {
      toast.error('Erro ao recalcular scores')
    } finally {
      setIsRecalculating(false)
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground">
              Gerencie seus clientes e contratos de rastreamento
            </p>
          </div>
          <Button className="shrink-0" onClick={handleNewClient}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
              <div className="p-6">
                <ClientForm
                  clientId={selectedClient || undefined}
                  onSuccess={handleDialogClose}
                  onCancel={handleDialogClose}
                  readOnly={viewMode === 'view'}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <ModernStatCard
            title="Total de Clientes"
            value={loading ? "..." : clients.length}
            icon={<Users className="h-6 w-6" />}
            description="Total cadastrado"
            isLoading={loading}
          />
          <ModernStatCard
            title="Clientes Ativos"
            value={loading ? "..." : activeCount}
            icon={<UserCheck className="h-6 w-6" />}
            description="Status ativo"
            variant="success"
            isLoading={loading}
          />
          <ModernStatCard
            title="Suspensos"
            value={loading ? "..." : suspendedCount}
            icon={<UserMinus className="h-6 w-6" />}
            description="Status suspenso"
            variant="warning"
            isLoading={loading}
          />
          <ModernStatCard
            title="Inativos"
            value={loading ? "..." : inactiveCount}
            icon={<UserX className="h-6 w-6" />}
            description="Status inativo"
            variant="danger"
            isLoading={loading}
          />
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Clientes</CardTitle>
            <CardDescription>Visualize e gerencie todos os seus clientes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou documento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filtros
              </Button>
              <Button 
                variant="outline" 
                onClick={handleRecalculateScores}
                disabled={isRecalculating || loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
                {isRecalculating ? 'Calculando...' : 'Recalcular Scores'}
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Cliente</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[160px]">Contato</TableHead>
                    <TableHead className="w-20 text-center">Score</TableHead>
                    <TableHead className="w-24 text-center">Status</TableHead>
                    <TableHead className="w-16 text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading || scoresLoading ? (
                    <ClientTableSkeleton rows={5} columns={5} />
                  ) : filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="text-muted-foreground">
                          {searchTerm ? 'Nenhum cliente encontrado para a busca.' : 'Nenhum cliente cadastrado ainda.'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedClients.map((client) => (
                      <ClientRow
                        key={client.id}
                        score={scores[client.id]}
                        client={client}
                        onView={handleViewClient}
                        onEdit={handleEditClient}
                        onDelete={handleDeleteClient}
                        onViewContracts={handleViewContracts}
                        onViewPaymentHistory={handleViewPaymentHistory}
                        onToggleWhatsApp={toggleWhatsApp}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {!loading && filteredClients.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>

                <div className="flex items-center gap-1 mx-4">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 text-sm rounded transition-colors ${
                          currentPage === pageNum
                            ? "border border-border bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

export default ClientsPage
