import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Plus, Search, Filter, MoreHorizontal, Phone, Mail, Edit, Trash2, Download, FileText, History, Eye } from "lucide-react"
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
import { useAsaasImport } from "@/hooks/useAsaasImport"
import { useFixAddresses } from "@/hooks/useFixAddresses"
import { Skeleton } from "@/components/ui/skeleton"

const ClientsPage = () => {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'edit' | 'view' | null>(null)
  const { clients, loading, deleteClient, loadClients } = useClients()
  const { importing, importCustomers } = useAsaasImport()
  const { fixing, fixAddresses } = useFixAddresses()

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

  const handleImportFromAsaas = async () => {
    if (confirm('Deseja importar todos os clientes cadastrados no Asaas? Esta é uma operação única.')) {
      const result = await importCustomers()
      if (result.success) {
        // Recarregar lista de clientes
        await loadClients()
      }
    }
  }

  const handleFixAddresses = async () => {
    if (confirm('Deseja corrigir os endereços dos clientes importados do Asaas? Esta operação converterá os endereços em texto para o formato estruturado do sistema.')) {
      const result = await fixAddresses()
      if (result.success) {
        // Recarregar lista de clientes
        await loadClients()
      }
    }
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
            <Button 
              variant="outline" 
              onClick={handleImportFromAsaas}
              disabled={importing || loading || fixing}
            >
              <Download className="w-4 h-4 mr-2" />
              {importing ? 'Importando...' : 'Importar do Asaas'}
            </Button>
            <Button 
              variant="outline"
              onClick={handleFixAddresses}
              disabled={fixing || loading || importing}
            >
              {fixing ? 'Corrigindo...' : 'Corrigir Endereços'}
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="shrink-0" onClick={() => setIsDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                <ScrollArea className="flex-1 p-6">
                  <ClientForm
                    clientId={selectedClient || undefined}
                    onSuccess={handleDialogClose}
                    onCancel={handleDialogClose}
                    readOnly={viewMode === 'view'}
                  />
                </ScrollArea>
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
                    filteredClients.map((client) => (
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
                            <div className="flex items-center text-sm">
                              <Phone className="w-3 h-3 mr-1 text-muted-foreground shrink-0" />
                              {client.phone}
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
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

export default ClientsPage