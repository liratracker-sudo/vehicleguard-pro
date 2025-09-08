import { useState, useEffect } from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Car, MapPin, Shield, Search, Filter, MoreHorizontal, Edit, Trash } from "lucide-react"
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
import { VehicleForm } from "@/components/vehicles/VehicleForm"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const loadVehicles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile?.company_id) return

      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)

      if (error) throw error

      // Buscar dados dos clientes separadamente
      const vehiclesWithClients = await Promise.all(
        (data || []).map(async (vehicle) => {
          if (vehicle.client_id) {
            const { data: client } = await supabase
              .from('clients')
              .select('name, phone')
              .eq('id', vehicle.client_id)
              .maybeSingle();
            
            return { ...vehicle, clients: client };
          }
          return vehicle;
        })
      );

      setVehicles(vehiclesWithClients || [])
    } catch (error) {
      console.error('Error loading vehicles:', error)
      toast({
        title: "Erro",
        description: "Erro ao carregar veículos",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVehicles()
  }, [])

  const filteredVehicles = vehicles.filter(vehicle =>
    vehicle.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.clients?.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/20 text-success border-success/30">Ativo</Badge>
      case 'inactive':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Inativo</Badge>
      case 'maintenance':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Manutenção</Badge>
      default:
        return <Badge variant="outline">Desconhecido</Badge>
    }
  }

  const handleEdit = (vehicleId: string) => {
    setEditingVehicle(vehicleId)
    setShowForm(true)
  }

  const handleDelete = async (vehicleId: string) => {
    if (!confirm('Tem certeza que deseja excluir este veículo?')) return

    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ is_active: false })
        .eq('id', vehicleId)

      if (error) throw error

      toast({
        title: "Veículo excluído",
        description: "Veículo removido com sucesso"
      })

      loadVehicles()
    } catch (error) {
      console.error('Error deleting vehicle:', error)
      toast({
        title: "Erro",
        description: "Erro ao excluir veículo",
        variant: "destructive"
      })
    }
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditingVehicle(null)
    loadVehicles()
  }

  const stats = {
    total: vehicles.length,
    active: vehicles.filter(v => v.tracker_status === 'active').length,
    alerts: vehicles.filter(v => v.tracker_status === 'maintenance').length
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Veículos</h1>
            <p className="text-muted-foreground">
              Gestão de veículos rastreados e equipamentos
            </p>
          </div>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button onClick={() => {setEditingVehicle(null); setShowForm(true)}}>
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar Veículo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogTitle className="sr-only">
                {editingVehicle ? 'Editar Veículo' : 'Cadastrar Veículo'}
              </DialogTitle>
              <VehicleForm
                vehicleId={editingVehicle || undefined}
                onSuccess={handleFormSuccess}
                onCancel={() => setShowForm(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Veículos</CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Veículos cadastrados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online</CardTitle>
              <MapPin className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.active}</div>
              <p className="text-xs text-muted-foreground">{stats.total > 0 ? ((stats.active / stats.total) * 100).toFixed(1) : 0}% dos veículos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertas Ativos</CardTitle>
              <Shield className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.alerts}</div>
              <p className="text-xs text-muted-foreground">Requer atenção</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Veículos</CardTitle>
            <CardDescription>
              Visualize e gerencie todos os veículos rastreados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por placa, modelo ou cliente..."
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
                    <TableHead>Veículo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Rastreador</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Instalação</TableHead>
                    <TableHead className="w-[70px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredVehicles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Nenhum veículo encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVehicles.map((vehicle) => (
                      <TableRow key={vehicle.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{vehicle.license_plate}</div>
                            <div className="text-sm text-muted-foreground">
                              {vehicle.brand} {vehicle.model} ({vehicle.year})
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{vehicle.clients?.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {vehicle.clients?.phone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {vehicle.tracker_device_id || 'Não informado'}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(vehicle.tracker_status)}</TableCell>
                        <TableCell>
                          {vehicle.installation_date ? new Date(vehicle.installation_date).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleEdit(vehicle.id)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(vehicle.id)}
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
    </AppLayout>
  )
}

export default VehiclesPage