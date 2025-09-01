import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, FileText, Send } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Badge } from "@/components/ui/badge"

interface ContractFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  contractId?: string
}

export function ContractForm({ onSuccess, onCancel, contractId }: ContractFormProps) {
  const [formData, setFormData] = useState({
    client_id: "",
    vehicle_id: "",
    plan_id: "",
    monthly_value: 0,
    start_date: new Date(),
    end_date: null as Date | null,
    contract_type: "service",
    signature_status: "pending"
  })
  
  const [clients, setClients] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile) return

      const [clientsRes, vehiclesRes, plansRes] = await Promise.all([
        supabase.from('clients').select('id, name, phone').eq('company_id', profile.company_id),
        supabase.from('vehicles').select('id, license_plate, model, brand, client_id').eq('company_id', profile.company_id),
        supabase.from('plans').select('id, name, price').eq('company_id', profile.company_id).eq('is_active', true)
      ])

      if (clientsRes.data) setClients(clientsRes.data)
      if (vehiclesRes.data) setVehicles(vehiclesRes.data)
      if (plansRes.data) setPlans(plansRes.data)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleClientChange = (clientId: string) => {
    setFormData({...formData, client_id: clientId})
    // Filter vehicles by selected client
    const clientVehicles = vehicles.filter(v => v.client_id === clientId)
    if (clientVehicles.length === 1) {
      setFormData(prev => ({...prev, client_id: clientId, vehicle_id: clientVehicles[0].id}))
    }
  }

  const handlePlanChange = (planId: string) => {
    const plan = plans.find(p => p.id === planId)
    setFormData({
      ...formData, 
      plan_id: planId,
      monthly_value: plan ? plan.price : 0
    })
  }

  const sendForSignature = async (contractId: string) => {
    try {
      // Here you would integrate with Autentique API
      // This is a placeholder for the actual integration
      toast({
        title: "Enviando para assinatura",
        description: "Contrato será enviado via Autentique API"
      })
      
      // Update contract status
      await supabase
        .from('contracts')
        .update({ signature_status: 'sent' })
        .eq('id', contractId)
        
    } catch (error) {
      console.error('Error sending for signature:', error)
      toast({
        title: "Erro",
        description: "Erro ao enviar para assinatura",
        variant: "destructive"
      })
    }
  }

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

      const contractData = {
        ...formData,
        company_id: profile.company_id,
        start_date: formData.start_date.toISOString().split('T')[0],
        end_date: formData.end_date ? formData.end_date.toISOString().split('T')[0] : null
      }

      const { data, error } = contractId 
        ? await supabase.from('contracts').update(contractData).eq('id', contractId).select().single()
        : await supabase.from('contracts').insert(contractData).select().single()

      if (error) throw error

      toast({
        title: contractId ? "Contrato atualizado" : "Contrato criado",
        description: "Operação realizada com sucesso!"
      })

      // If new contract, ask if user wants to send for signature
      if (!contractId && data) {
        const shouldSend = window.confirm("Deseja enviar este contrato para assinatura eletrônica?")
        if (shouldSend) {
          await sendForSignature(data.id)
        }
      }

      onSuccess?.()
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Erro",
        description: "Erro ao salvar contrato",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
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

  const filteredVehicles = vehicles.filter(v => 
    !formData.client_id || v.client_id === formData.client_id
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {contractId ? 'Editar' : 'Criar'} Contrato
          {contractId && (
            <div className="ml-auto">
              {getStatusBadge(formData.signature_status)}
            </div>
          )}
        </CardTitle>
        <CardDescription>
          Crie contratos digitais com assinatura eletrônica via Autentique
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client_id">Cliente *</Label>
              <Select 
                value={formData.client_id}
                onValueChange={handleClientChange}
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
            <div>
              <Label htmlFor="vehicle_id">Veículo</Label>
              <Select 
                value={formData.vehicle_id}
                onValueChange={(value) => setFormData({...formData, vehicle_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o veículo" />
                </SelectTrigger>
                <SelectContent>
                  {filteredVehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.license_plate} - {vehicle.brand} {vehicle.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="plan_id">Plano *</Label>
              <Select 
                value={formData.plan_id}
                onValueChange={handlePlanChange}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - R$ {plan.price.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="monthly_value">Valor Mensal *</Label>
              <Input
                id="monthly_value"
                type="number"
                step="0.01"
                value={formData.monthly_value}
                onChange={(e) => setFormData({...formData, monthly_value: parseFloat(e.target.value)})}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data de Início *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.start_date ? (
                      format(formData.start_date, "PPP")
                    ) : (
                      <span>Selecione a data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.start_date}
                    onSelect={(date) => date && setFormData({...formData, start_date: date})}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Data de Vencimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.end_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.end_date ? (
                      format(formData.end_date, "PPP")
                    ) : (
                      <span>Selecione a data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.end_date}
                    onSelect={(date) => setFormData({...formData, end_date: date})}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            <Label htmlFor="contract_type">Tipo de Contrato</Label>
            <Select 
              value={formData.contract_type}
              onValueChange={(value) => setFormData({...formData, contract_type: value})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service">Prestação de Serviços</SelectItem>
                <SelectItem value="rental">Locação</SelectItem>
                <SelectItem value="maintenance">Manutenção</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : contractId ? "Atualizar" : "Criar Contrato"}
            </Button>
            {contractId && formData.signature_status === 'pending' && (
              <Button 
                type="button" 
                variant="outline"
                onClick={() => sendForSignature(contractId)}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Enviar para Assinatura
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}