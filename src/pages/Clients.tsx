import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Plus, Search, Filter, MoreHorizontal, Phone, Mail, Edit, Trash2, FileText, History, Eye, MessageSquare, MessageSquareOff, Ban, ChevronLeft, ChevronRight } from "lucide-react"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ClientForm } from "@/components/clients/ClientForm"
import { useClients } from "@/hooks/useClients"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

const ITEMS_PER_PAGE = 15

const ClientsPage = () => {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'edit' | 'view' | null>(null)
  const { clients, loading, deleteClient, loadClients, toggleWhatsApp } = useClients()

  const handleViewContracts = (clientId: string) => {
    navigate(`/contracts?client_id=${clientId}`)
  }

  const handleViewPaymentHistory = (clientId: string) => {
    navigate(`/billing?client_id=${clientId}`)
  }

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (client.document && client.document.includes(searchTerm))
  )

  // Paginação
  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedClients = filteredClients.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  // Reset para página 1 quando buscar
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

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setSelectedClient(null)
    setViewMode(null)
  }


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/20 text-success border-success/30">Ativo</Badge>
      case 'suspended':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Suspenso</Badge>
      case 'inactive':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Inativo</Badge>
      default:
        return <Badge variant="outline">Desconhecido</Badge>
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
          <div className="flex gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="shrink-0" onClick={() => setIsDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Cliente
                </Button>
              </DialogTrigger>
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
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : clients.length}</div>
              <p className="text-xs text-muted-foreground">Total cadastrado</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Skeleton className="h-8 w-16" /> : clients.filter(c => c.status === 'active').length}
              </div>
              <p className="text-xs text-muted-foreground">Status ativo</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Suspensos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Skeleton className="h-8 w-16" /> : clients.filter(c => c.status === 'suspended').length}
              </div>
              <p className="text-xs text-muted-foreground">Status suspenso</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Skeleton className="h-8 w-16" /> : clients.filter(c => c.status === 'inactive').length}
              </div>
              <p className="text-xs text-muted-foreground">Status inativo</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Clientes</CardTitle>
            <CardDescription>
              Visualize e gerencie todos os seus clientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou documento..."
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

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden md:table-cell">Contato</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-16">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    // Loading skeleton
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div>
                              <Skeleton className="h-4 w-32 mb-1" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="space-y-1">
                            <Skeleton className="h-3 w-40" />
                            <Skeleton className="h-3 w-28" />
                          </div>
                        </TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <div className="text-muted-foreground">
                          {searchTerm ? 'Nenhum cliente encontrado para a busca.' : 'Nenhum cliente cadastrado ainda.'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-10 w-10 shrink-0">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{client.name}</div>
                              <div className="text-sm text-muted-foreground truncate">
                                {client.document || 'Sem documento'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="space-y-1">
                            <div className="flex items-center text-sm">
                              <Mail className="w-3 h-3 mr-1 text-muted-foreground shrink-0" />
                              <span className="truncate">{client.email || 'Não informado'}</span>
                            </div>
                            <div className="flex items-center text-sm gap-1">
                              <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                              {client.phone}
                              <TooltipProvider>
                                {client.whatsapp_opt_out && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <MessageSquareOff className="w-3.5 h-3.5 text-destructive" />
                                    </TooltipTrigger>
                                    <TooltipContent>WhatsApp desabilitado manualmente</TooltipContent>
                                  </Tooltip>
                                )}
                                {client.whatsapp_blocked && !client.whatsapp_opt_out && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Ban className="w-3.5 h-3.5 text-warning" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Bloqueado: {client.whatsapp_block_reason || 'Múltiplas falhas'}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {!client.whatsapp_opt_out && !client.whatsapp_blocked && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <MessageSquare className="w-3.5 h-3.5 text-success" />
                                    </TooltipTrigger>
                                    <TooltipContent>WhatsApp ativo</TooltipContent>
                                  </Tooltip>
                                )}
                              </TooltipProvider>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(client.status)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuItem onSelect={() => handleViewClient(client.id)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Visualizar cliente
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleEditClient(client.id)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Editar cliente
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleViewContracts(client.id)}>
                                <FileText className="w-4 h-4 mr-2" />
                                Ver contratos
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleViewPaymentHistory(client.id)}>
                                <History className="w-4 h-4 mr-2" />
                                Histórico de pagamentos
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => toggleWhatsApp(client.id, client.whatsapp_opt_out)}>
                                {client.whatsapp_opt_out ? (
                                  <>
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    Habilitar WhatsApp
                                  </>
                                ) : (
                                  <>
                                    <MessageSquareOff className="w-4 h-4 mr-2" />
                                    Desabilitar WhatsApp
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onSelect={() => handleDeleteClient(client.id, client.name)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir cliente
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

            {/* Paginação */}
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