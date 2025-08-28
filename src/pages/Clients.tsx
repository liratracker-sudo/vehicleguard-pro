import { useState } from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Plus, Search, Filter, MoreHorizontal, Phone, Mail, MapPin } from "lucide-react"
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

const clients = [
  {
    id: 1,
    name: "Maria Santos Silva",
    email: "maria.santos@email.com",
    phone: "(11) 99999-1234",
    document: "123.456.789-10",
    address: "Rua das Flores, 123 - São Paulo, SP",
    status: "active",
    plan: "Premium",
    vehicles: 3,
    monthlyValue: 450.00,
    lastPayment: "2024-01-15",
    joinedAt: "2023-06-15"
  },
  {
    id: 2,
    name: "João Oliveira Costa",
    email: "joao.oliveira@email.com",
    phone: "(11) 98888-5678",
    document: "987.654.321-00",
    address: "Av. Paulista, 1000 - São Paulo, SP",
    status: "active",
    plan: "Básico",
    vehicles: 1,
    monthlyValue: 150.00,
    lastPayment: "2024-01-14",
    joinedAt: "2023-08-20"
  },
  {
    id: 3,
    name: "Ana Costa Ferreira",
    email: "ana.costa@email.com",
    phone: "(11) 97777-9012",
    document: "456.789.123-45",
    address: "Rua Augusta, 500 - São Paulo, SP",
    status: "suspended",
    plan: "Premium",
    vehicles: 2,
    monthlyValue: 300.00,
    lastPayment: "2023-12-10",
    joinedAt: "2023-03-10"
  },
  {
    id: 4,
    name: "Carlos Silva Mendes",
    email: "carlos.silva@email.com",
    phone: "(11) 96666-3456",
    document: "789.123.456-78",
    address: "Rua da Consolação, 800 - São Paulo, SP",
    status: "active",
    plan: "Empresarial",
    vehicles: 10,
    monthlyValue: 1200.00,
    lastPayment: "2024-01-12",
    joinedAt: "2023-01-05"
  }
]

const ClientsPage = () => {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.document.includes(searchTerm)
  )

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
          <Button className="shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234</div>
              <p className="text-xs text-muted-foreground">+12% vs mês anterior</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,156</div>
              <p className="text-xs text-muted-foreground">93.7% do total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Suspensos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">45</div>
              <p className="text-xs text-muted-foreground">3.6% do total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ 187K</div>
              <p className="text-xs text-muted-foreground">+8.5% vs mês anterior</p>
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
                    <TableHead>Contato</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Veículos</TableHead>
                    <TableHead>Valor Mensal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[70px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{client.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {client.document}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center text-sm">
                            <Mail className="w-3 h-3 mr-1 text-muted-foreground" />
                            {client.email}
                          </div>
                          <div className="flex items-center text-sm">
                            <Phone className="w-3 h-3 mr-1 text-muted-foreground" />
                            {client.phone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{client.plan}</Badge>
                      </TableCell>
                      <TableCell>{client.vehicles}</TableCell>
                      <TableCell>R$ {client.monthlyValue.toFixed(2)}</TableCell>
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
                            <DropdownMenuItem>Ver detalhes</DropdownMenuItem>
                            <DropdownMenuItem>Editar cliente</DropdownMenuItem>
                            <DropdownMenuItem>Ver contratos</DropdownMenuItem>
                            <DropdownMenuItem>Histórico de pagamentos</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              Suspender cliente
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
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