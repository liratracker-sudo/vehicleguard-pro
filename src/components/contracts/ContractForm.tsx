import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, FileText, Send, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
  const [dataLoading, setDataLoading] = useState(true)
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const { toast } = useToast()

  const loadData = async () => {
    try {
      setDataLoading(true);
      console.log('📋 Carregando dados do formulário...');
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('❌ Usuário não encontrado');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile?.company_id) {
        console.log('❌ Perfil da empresa não encontrado');
        return;
      }

      console.log('🏢 Company ID:', profile.company_id);

      // Carregar dados em paralelo
      const [clientsRes, vehiclesRes, plansRes] = await Promise.all([
        supabase.from('clients').select('id, name, phone, email').eq('company_id', profile.company_id).eq('status', 'active'),
        supabase.from('vehicles').select('id, license_plate, model, brand, client_id').eq('company_id', profile.company_id).eq('is_active', true),
        supabase.from('plans').select('id, name, price').eq('company_id', profile.company_id).eq('is_active', true)
      ])

      console.log('📊 Dados carregados:', {
        clients: clientsRes.data?.length || 0,
        vehicles: vehiclesRes.data?.length || 0,
        plans: plansRes.data?.length || 0
      });

      if (clientsRes.data) setClients(clientsRes.data)
      if (vehiclesRes.data) setVehicles(vehiclesRes.data)
      if (plansRes.data) setPlans(plansRes.data)

      // Load existing contract if editing
      if (contractId) {
        console.log('✏️ Carregando contrato para edição:', contractId);
        
        const { data: contract, error } = await supabase
          .from('contracts')
          .select('*')
          .eq('id', contractId)
          .maybeSingle()

        if (error) {
          console.error('❌ Erro ao carregar contrato:', error);
          throw error;
        }

        if (contract) {
          console.log('✅ Contrato carregado:', contract);
          setFormData({
            client_id: contract.client_id,
            vehicle_id: contract.vehicle_id || "",
            plan_id: contract.plan_id,
            monthly_value: contract.monthly_value,
            start_date: new Date(contract.start_date),
            end_date: contract.end_date ? new Date(contract.end_date) : null,
            contract_type: contract.contract_type || "service",
            signature_status: contract.signature_status
          })
        }
      }
    } catch (error: any) {
      console.error('❌ Erro ao carregar dados:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar dados",
        variant: "destructive"
      })
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    loadData()
  }, [contractId])

  const handleClientChange = (clientId: string) => {
    setFormData({...formData, client_id: clientId, vehicle_id: ""})
  }

  const handlePlanChange = (planId: string) => {
    const plan = plans.find(p => p.id === planId)
    setFormData({
      ...formData, 
      plan_id: planId,
      monthly_value: plan ? plan.price : 0
    })
  }

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}

    if (!formData.client_id) {
      newErrors.client_id = "Cliente é obrigatório"
    }
    if (!formData.plan_id) {
      newErrors.plan_id = "Plano é obrigatório"
    }
    if (!formData.monthly_value || formData.monthly_value <= 0) {
      newErrors.monthly_value = "Valor mensal deve ser maior que zero"
    }
    if (!formData.start_date) {
      newErrors.start_date = "Data de início é obrigatória"
    }
    if (formData.end_date && formData.end_date <= formData.start_date) {
      newErrors.end_date = "Data de vencimento deve ser posterior à data de início"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const sendForSignature = async (contractId: string) => {
    try {
      setLoading(true)
      
      // Get client and contract details
      const selectedClient = clients.find(c => c.id === formData.client_id)
      if (!selectedClient) {
        throw new Error("Cliente não encontrado")
      }

      // Call Autentique integration
      const response = await supabase.functions.invoke('autentique-integration', {
        body: {
          action: 'create_document',
          contractData: {
            client_name: selectedClient.name,
            client_email: selectedClient.email,
            client_phone: selectedClient.phone,
            contract_title: `Contrato de Prestação de Serviços - ${selectedClient.name}`,
            contract_content: generateContractContent(selectedClient)
          }
        }
      })

      if (response.error) {
        throw new Error(response.error.message)
      }

      // Update contract with Autentique document ID
      const { error: updateError } = await supabase
        .from('contracts')
        .update({ 
          signature_status: 'sent',
          autentique_document_id: response.data.document.id,
          document_url: `https://app.autentique.com.br/document/${response.data.document.id}`
        })
        .eq('id', contractId)

      if (updateError) throw updateError

      toast({
        title: "Enviado para assinatura",
        description: "Contrato enviado com sucesso via Autentique!"
      })
        
    } catch (error: any) {
      console.error('Error sending for signature:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar para assinatura",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const generateContractContent = (client: any) => {
    const selectedPlan = plans.find(p => p.id === formData.plan_id)
    const selectedVehicle = vehicles.find(v => v.id === formData.vehicle_id)
    
    return `
CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: ${client.name}
E-mail: ${client.email}
Telefone: ${client.phone}

PLANO: ${selectedPlan?.name || 'Não especificado'}
VALOR MENSAL: R$ ${formData.monthly_value.toFixed(2)}

${selectedVehicle ? `VEÍCULO: ${selectedVehicle.license_plate} - ${selectedVehicle.brand} ${selectedVehicle.model}` : ''}

VIGÊNCIA: ${format(formData.start_date, 'dd/MM/yyyy')} ${formData.end_date ? `até ${format(formData.end_date, 'dd/MM/yyyy')}` : '(prazo indeterminado)'}

TIPO DE CONTRATO: ${formData.contract_type === 'service' ? 'Prestação de Serviços' : formData.contract_type === 'rental' ? 'Locação' : 'Manutenção'}

Este contrato estabelece os termos e condições para a prestação dos serviços contratados.

_________________________________
Assinatura do Contratante
    `
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('📤 Iniciando salvamento do contrato...');
    console.log('📋 Dados do formulário:', formData);
    
    if (!validateForm()) {
      toast({
        title: "Formulário inválido",
        description: "Verifique os campos obrigatórios",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Usuário não autenticado')
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile?.company_id) {
        throw new Error('Perfil da empresa não encontrado')
      }

      const contractData = {
        client_id: formData.client_id,
        plan_id: formData.plan_id,
        vehicle_id: formData.vehicle_id || null,
        monthly_value: formData.monthly_value,
        start_date: formData.start_date.toISOString().split('T')[0],
        end_date: formData.end_date ? formData.end_date.toISOString().split('T')[0] : null,
        contract_type: formData.contract_type,
        company_id: profile.company_id,
        status: 'active',
        signature_status: contractId ? formData.signature_status : 'pending'
      }

      console.log('💾 Dados para salvar:', contractData);

      let result;
      if (contractId) {
        // Atualizar contrato existente
        const { data, error } = await supabase
          .from('contracts')
          .update(contractData)
          .eq('id', contractId)
          .select()
          .single()
        
        if (error) throw error;
        result = data;
      } else {
        // Criar novo contrato
        const { data, error } = await supabase
          .from('contracts')
          .insert(contractData)
          .select()
          .single()
        
        if (error) throw error;
        result = data;
      }

      console.log('✅ Contrato salvo com sucesso:', result);

      toast({
        title: contractId ? "Contrato atualizado" : "Contrato criado",
        description: "Operação realizada com sucesso!"
      })

      // If new contract, ask if user wants to send for signature
      if (!contractId && result) {
        const shouldSend = window.confirm("Deseja enviar este contrato para assinatura eletrônica?")
        if (shouldSend) {
          await sendForSignature(result.id)
        }
      }

      onSuccess?.()
    } catch (error: any) {
      console.error('❌ Erro ao salvar contrato:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar contrato",
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
        {dataLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando dados...</p>
            </div>
          </div>
        ) : clients.length === 0 ? (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhum cliente encontrado. Você precisa cadastrar clientes antes de criar contratos.
            </AlertDescription>
          </Alert>
        ) : plans.length === 0 ? (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhum plano encontrado. Você precisa cadastrar planos antes de criar contratos.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {Object.keys(errors).length > 0 && (
              <Alert className="mb-4" variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Corrija os erros no formulário antes de continuar.
                </AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="client_id">Cliente *</Label>
                  <Select 
                    value={formData.client_id}
                    onValueChange={handleClientChange}
                    required
                  >
                    <SelectTrigger className={errors.client_id ? "border-destructive" : ""}>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name} - {client.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.client_id && (
                    <p className="text-sm text-destructive mt-1">{errors.client_id}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="vehicle_id">Veículo (Opcional)</Label>
                  <Select 
                    value={formData.vehicle_id}
                    onValueChange={(value) => setFormData({...formData, vehicle_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o veículo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum veículo</SelectItem>
                      {filteredVehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.license_plate} - {vehicle.brand} {vehicle.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="plan_id">Plano *</Label>
                  <Select 
                    value={formData.plan_id}
                    onValueChange={handlePlanChange}
                    required
                  >
                    <SelectTrigger className={errors.plan_id ? "border-destructive" : ""}>
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
                  {errors.plan_id && (
                    <p className="text-sm text-destructive mt-1">{errors.plan_id}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="monthly_value">Valor Mensal *</Label>
                  <Input
                    id="monthly_value"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.monthly_value || ''}
                    onChange={(e) => setFormData({...formData, monthly_value: parseFloat(e.target.value) || 0})}
                    className={errors.monthly_value ? "border-destructive" : ""}
                    required
                  />
                  {errors.monthly_value && (
                    <p className="text-sm text-destructive mt-1">{errors.monthly_value}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Data de Início *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.start_date && "text-muted-foreground",
                          errors.start_date && "border-destructive"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.start_date ? (
                          format(formData.start_date, "dd/MM/yyyy")
                        ) : (
                          <span>Selecione a data</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.start_date}
                        onSelect={(date) => {
                          if (date) {
                            setFormData({...formData, start_date: date})
                            setErrors({...errors, start_date: ""})
                          }
                        }}
                        initialFocus
                        className="p-3"
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.start_date && (
                    <p className="text-sm text-destructive mt-1">{errors.start_date}</p>
                  )}
                </div>
                <div>
                  <Label>Data de Vencimento (Opcional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.end_date && "text-muted-foreground",
                          errors.end_date && "border-destructive"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.end_date ? (
                          format(formData.end_date, "dd/MM/yyyy")
                        ) : (
                          <span>Selecione a data (opcional)</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.end_date}
                        onSelect={(date) => {
                          setFormData({...formData, end_date: date})
                          setErrors({...errors, end_date: ""})
                        }}
                        disabled={(date) => date <= formData.start_date}
                        initialFocus
                        className="p-3"
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.end_date && (
                    <p className="text-sm text-destructive mt-1">{errors.end_date}</p>
                  )}
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

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button type="submit" disabled={loading} className="flex-1 sm:flex-none">
                  {loading ? "Salvando..." : contractId ? "Atualizar Contrato" : "Criar Contrato"}
                </Button>
                {contractId && (formData.signature_status === 'pending' || formData.signature_status === 'cancelled') && (
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => sendForSignature(contractId)}
                    disabled={loading}
                    className="gap-2 flex-1 sm:flex-none"
                  >
                    <Send className="h-4 w-4" />
                    Enviar para Assinatura
                  </Button>
                )}
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onCancel}
                  disabled={loading}
                  className="flex-1 sm:flex-none"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  )
}