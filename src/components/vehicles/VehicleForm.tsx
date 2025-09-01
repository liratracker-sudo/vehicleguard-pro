import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface VehicleFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  vehicleId?: string
}

export function VehicleForm({ onSuccess, onCancel, vehicleId }: VehicleFormProps) {
  const [formData, setFormData] = useState({
    license_plate: "",
    model: "",
    brand: "",
    year: new Date().getFullYear(),
    color: "",
    chassis: "",
    client_id: "",
    tracker_status: "active",
    tracker_device_id: "",
    installation_date: new Date(),
    notes: ""
  })
  
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const loadClients = async () => {
    const { data } = await supabase.from('clients').select('id, name').eq('status', 'active')
    if (data) setClients(data)
  }

  useEffect(() => {
    loadClients()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile) throw new Error('Profile not found')

      const vehicleData = {
        ...formData,
        company_id: profile.company_id,
        installation_date: formData.installation_date.toISOString().split('T')[0]
      }

      const { error } = vehicleId 
        ? await supabase.from('vehicles').update(vehicleData).eq('id', vehicleId)
        : await supabase.from('vehicles').insert(vehicleData)

      if (error) throw error

      toast({
        title: vehicleId ? "Veículo atualizado" : "Veículo cadastrado",
        description: "Operação realizada com sucesso!"
      })

      onSuccess?.()
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Erro",
        description: "Erro ao salvar veículo",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{vehicleId ? 'Editar' : 'Cadastrar'} Veículo</CardTitle>
        <CardDescription>
          Preencha os dados do veículo para rastreamento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="license_plate">Placa *</Label>
              <Input
                id="license_plate"
                value={formData.license_plate}
                onChange={(e) => setFormData({...formData, license_plate: e.target.value.toUpperCase()})}
                placeholder="ABC-1234"
                required
              />
            </div>
            <div>
              <Label htmlFor="client_id">Cliente *</Label>
              <Select 
                value={formData.client_id}
                onValueChange={(value) => setFormData({...formData, client_id: value})}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="brand">Marca *</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData({...formData, brand: e.target.value})}
                placeholder="Toyota"
                required
              />
            </div>
            <div>
              <Label htmlFor="model">Modelo *</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({...formData, model: e.target.value})}
                placeholder="Corolla"
                required
              />
            </div>
            <div>
              <Label htmlFor="year">Ano *</Label>
              <Input
                id="year"
                type="number"
                min="1900"
                max={new Date().getFullYear() + 1}
                value={formData.year}
                onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="color">Cor *</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => setFormData({...formData, color: e.target.value})}
                placeholder="Branco"
                required
              />
            </div>
            <div>
              <Label htmlFor="chassis">Chassi</Label>
              <Input
                id="chassis"
                value={formData.chassis}
                onChange={(e) => setFormData({...formData, chassis: e.target.value})}
                placeholder="9BWZZZ377VT004251"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tracker_device_id">ID do Rastreador</Label>
              <Input
                id="tracker_device_id"
                value={formData.tracker_device_id}
                onChange={(e) => setFormData({...formData, tracker_device_id: e.target.value})}
                placeholder="TRK123456"
              />
            </div>
            <div>
              <Label htmlFor="tracker_status">Status do Rastreador</Label>
              <Select 
                value={formData.tracker_status}
                onValueChange={(value) => setFormData({...formData, tracker_status: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="maintenance">Manutenção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Data de Instalação</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.installation_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.installation_date ? (
                    format(formData.installation_date, "PPP")
                  ) : (
                    <span>Selecione a data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.installation_date}
                  onSelect={(date) => date && setFormData({...formData, installation_date: date})}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Observações sobre o veículo..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : vehicleId ? "Atualizar" : "Cadastrar"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}