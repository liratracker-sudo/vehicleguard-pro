import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { CalendarIcon, FileText, Send, AlertCircle, Eye, Car } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useContractTemplates } from "@/hooks/useContractTemplates"
import { ContractPreview } from "./ContractPreview"
import { preventWheelChange } from "@/lib/no-wheel";

interface ContractFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  contractId?: string
}

export function ContractForm({ onSuccess, onCancel, contractId }: ContractFormProps) {
  const [formData, setFormData] = useState({
    client_id: "",
    vehicle_ids: [] as string[],
    plan_id: "",
    monthly_value: 0,
    start_date: new Date(),
    end_date: null as Date | null,
    contract_type: "service",
    signature_status: "pending",
    template_id: ""
  })
  
  const [clients, setClients] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [showPreview, setShowPreview] = useState(false)
  const [companyInfo, setCompanyInfo] = useState<{
    name: string
    cnpj: string | null
    address: string | null
    ownerName: string | null
  } | null>(null)
  // Cache de contexto do usuário para evitar múltiplas requisições
  const [userContext, setUserContext] = useState<{
    userId: string
    companyId: string
  } | null>(null)
  const { toast } = useToast()
  const { templates } = useContractTemplates()

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

      // Cachear contexto do usuário para uso posterior
      setUserContext({ userId: user.id, companyId: profile.company_id })

      console.log('🏢 Company ID:', profile.company_id);

      // Carregar dados em paralelo (incluindo dados da empresa)
      const [clientsRes, vehiclesRes, plansRes, companyRes, ownerRes] = await Promise.all([
        supabase.from('clients').select('id, name, phone, email, document').eq('company_id', profile.company_id).eq('status', 'active').order('name'),
        supabase.from('vehicles').select('id, license_plate, model, brand, client_id').eq('company_id', profile.company_id).eq('is_active', true),
        supabase.from('plans').select('id, name, price').eq('company_id', profile.company_id).eq('is_active', true),
        supabase.from('companies').select('name, cnpj, address').eq('id', profile.company_id).maybeSingle(),
        supabase.from('profiles').select('full_name').eq('company_id', profile.company_id).eq('role', 'admin').limit(1).maybeSingle()
      ])

      console.log('📊 Dados carregados:', {
        clients: clientsRes.data?.length || 0,
        vehicles: vehiclesRes.data?.length || 0,
        plans: plansRes.data?.length || 0,
        company: companyRes.data?.name || 'N/A'
      });

      if (clientsRes.data) setClients(clientsRes.data)
      if (vehiclesRes.data) setVehicles(vehiclesRes.data)
      if (plansRes.data) setPlans(plansRes.data)
      
      // Salvar dados da empresa
      setCompanyInfo({
        name: companyRes.data?.name || '',
        cnpj: companyRes.data?.cnpj || null,
        address: companyRes.data?.address || null,
        ownerName: ownerRes.data?.full_name || null
      })

      // Load existing contract if editing
      if (contractId) {
        console.log('✏️ Carregando contrato para edição:', contractId);
        
        const [contractRes, vehiclesContractRes] = await Promise.all([
          supabase
            .from('contracts')
            .select('*')
            .eq('id', contractId)
            .maybeSingle(),
          supabase
            .from('contract_vehicles')
            .select('vehicle_id')
            .eq('contract_id', contractId)
        ])

        if (contractRes.error) {
          console.error('❌ Erro ao carregar contrato:', contractRes.error);
          throw contractRes.error;
        }

        const contract = contractRes.data;
        const contractVehicleIds = vehiclesContractRes.data?.map(cv => cv.vehicle_id) || [];

        if (contract) {
          console.log('✅ Contrato carregado:', contract);
          // Se tem vehicle_id antigo e não tem na nova tabela, migrar
          const vehicleIds = contractVehicleIds.length > 0 
            ? contractVehicleIds 
            : contract.vehicle_id 
              ? [contract.vehicle_id] 
              : [];
          
          setFormData({
            client_id: contract.client_id,
            vehicle_ids: vehicleIds,
            plan_id: contract.plan_id,
            monthly_value: contract.monthly_value,
            start_date: new Date(contract.start_date),
            end_date: contract.end_date ? new Date(contract.end_date) : null,
            contract_type: contract.contract_type || "service",
            signature_status: contract.signature_status,
            template_id: ""
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
    setFormData({...formData, client_id: clientId, vehicle_ids: []})
  }

  const handlePlanChange = (planId: string) => {
    const plan = plans.find(p => p.id === planId)
    // Sugerir valor baseado no plano e quantidade de veículos
    const vehicleCount = formData.vehicle_ids.length || 1
    const suggestedValue = plan ? plan.price * vehicleCount : 0
    
    setFormData({
      ...formData, 
      plan_id: planId,
      monthly_value: suggestedValue
    })
  }

  const handleVehicleToggle = (vehicleId: string, checked: boolean) => {
    let newVehicleIds: string[]
    if (checked) {
      newVehicleIds = [...formData.vehicle_ids, vehicleId]
    } else {
      newVehicleIds = formData.vehicle_ids.filter(id => id !== vehicleId)
    }
    
    // Atualizar sugestão de valor se tiver plano selecionado
    const plan = plans.find(p => p.id === formData.plan_id)
    const vehicleCount = newVehicleIds.length || 1
    const suggestedValue = plan ? plan.price * vehicleCount : formData.monthly_value
    
    setFormData({
      ...formData, 
      vehicle_ids: newVehicleIds,
      monthly_value: suggestedValue
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

  const sendForSignature = async (contractIdToSign: string) => {
    try {
      console.log('📤 Enviando contrato para assinatura em background:', contractIdToSign)
      
      const selectedClient = clients.find(c => c.id === formData.client_id)
      if (!selectedClient) {
        throw new Error("Cliente não encontrado")
      }

      // Usar contexto cacheado
      const companyId = userContext?.companyId
      if (!companyId) {
        throw new Error("Contexto da empresa não encontrado")
      }

      // Buscar WhatsApp settings em paralelo com a chamada Assinafy
      const whatsappPromise = supabase
        .from('whatsapp_settings')
        .select('instance_url, instance_name, api_token, is_active, connection_status')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .maybeSingle()

      const response = await supabase.functions.invoke('assinafy-integration', {
        body: {
          action: 'createDocument',
          client_name: selectedClient.name,
          client_email: selectedClient.email,
          client_cpf: selectedClient.document,
          content: generateContractContent(selectedClient),
          title: `Contrato de Prestação de Serviços - ${selectedClient.name}`,
          company_name: companyInfo?.name,
          company_cnpj: companyInfo?.cnpj,
          company_address: companyInfo?.address,
          company_owner: companyInfo?.ownerName
        }
      })

      console.log("📥 Resposta Assinafy:", response);

      if (response.error) {
        console.error("❌ Erro na resposta:", response.error);
        throw new Error(`Erro na Edge Function: ${response.error.message}`);
      }

      if (!response.data?.success) {
        const errorMsg = response.data?.error || 'Erro desconhecido ao criar documento no Assinafy';
        const errorDetails = response.data?.details ? ` (${JSON.stringify(response.data.details)})` : '';
        console.error("❌ Falha na criação do documento:", errorMsg, errorDetails);
        throw new Error(errorMsg);
      }

      const { error: updateError } = await supabase
        .from('contracts')
        .update({ 
          signature_status: 'pending',
          assinafy_document_id: response.data.document_id,
          document_url: response.data.signing_url
        })
        .eq('id', contractIdToSign)

      if (updateError) throw updateError

      // Enviar notificação WhatsApp (não bloqueia)
      if (response.data.signing_url) {
        const { data: whatsappSettings } = await whatsappPromise
        
        if (whatsappSettings?.connection_status === 'connected' && selectedClient.phone) {
          const selectedPlan = plans.find(p => p.id === formData.plan_id)
          const message = `Olá ${selectedClient.name}! 📄\n\nSeu contrato está pronto para assinatura digital.\n\n📋 *Plano:* ${selectedPlan?.name || 'Contratado'}\n💰 *Valor:* R$ ${Number(formData.monthly_value).toFixed(2)}/mês\n\n🔗 *Acesse o link abaixo para assinar:*\n${response.data.signing_url}\n\nEm caso de dúvidas, entre em contato.`

          // Enviar WhatsApp em background (fire and forget)
          supabase.functions.invoke('whatsapp-evolution', {
            body: {
              action: 'send_message',
              instance_url: whatsappSettings.instance_url,
              api_token: whatsappSettings.api_token,
              instance_name: whatsappSettings.instance_name,
              phone_number: selectedClient.phone,
              message: message,
              company_id: companyId,
              client_id: formData.client_id
            }
          }).then(() => {
            console.log('✅ WhatsApp enviado para cliente com link de assinatura')
          }).catch(whatsappError => {
            console.error('Erro ao enviar WhatsApp:', whatsappError)
          })
        } else {
          console.log('⚠️ WhatsApp não configurado/conectado ou cliente sem telefone')
        }
      }

      toast({
        title: "Enviado para assinatura",
        description: "Contrato enviado com sucesso via Assinafy!"
      })
        
    } catch (error: any) {
      console.error('❌ Erro detalhado ao enviar para assinatura:', error);
      
      let errorMessage = "Erro ao enviar para assinatura";
      
      if (error.message?.includes('API Assinafy:')) {
        errorMessage = error.message;
      } else if (error.message?.includes('Edge Function')) {
        errorMessage = `Problema na integração: ${error.message}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erro na Assinatura Eletrônica",
        description: errorMessage,
        variant: "destructive"
      });
    }
  }

  const getSelectedVehicles = () => {
    return vehicles.filter(v => formData.vehicle_ids.includes(v.id))
  }

  const replaceTemplateVariables = (template: string, client: any) => {
    const selectedPlan = plans.find(p => p.id === formData.plan_id)
    const selectedVehicles = getSelectedVehicles()
    
    const vehiclesInfo = selectedVehicles.length > 0
      ? selectedVehicles.map(v => `${v.license_plate} - ${v.brand} ${v.model}`).join('\n')
      : 'Não especificado'
    
    return template
      .replace(/\{\{cliente_nome\}\}/g, client.name || '')
      .replace(/\{\{cliente_email\}\}/g, client.email || '')
      .replace(/\{\{cliente_telefone\}\}/g, client.phone || '')
      .replace(/\{\{cliente_documento\}\}/g, client.document || '')
      .replace(/\{\{plano_nome\}\}/g, selectedPlan?.name || 'Não especificado')
      .replace(/\{\{valor_mensal\}\}/g, `R$ ${formData.monthly_value.toFixed(2)}`)
      .replace(/\{\{veiculo_info\}\}/g, vehiclesInfo)
      .replace(/\{\{data_inicio\}\}/g, format(formData.start_date, 'dd/MM/yyyy'))
      .replace(/\{\{data_fim\}\}/g, formData.end_date ? `até ${format(formData.end_date, 'dd/MM/yyyy')}` : '(prazo indeterminado)')
      // Variáveis da empresa
      .replace(/\{\{empresa_razao_social\}\}/g, companyInfo?.name || '[Nome da Empresa]')
      .replace(/\{\{empresa_nome\}\}/g, companyInfo?.name || '[Nome da Empresa]')
      .replace(/\{\{empresa_cnpj\}\}/g, companyInfo?.cnpj || '[CNPJ]')
      .replace(/\{\{empresa_endereco\}\}/g, companyInfo?.address || '[Endereço]')
      .replace(/\{\{empresa_responsavel\}\}/g, companyInfo?.ownerName || '[Responsável]')
  }

  const generateContractContent = (client: any) => {
    const selectedTemplate = templates.find(t => t.id === formData.template_id)
    
    if (selectedTemplate) {
      return replaceTemplateVariables(selectedTemplate.content, client)
    }
    
    const selectedPlan = plans.find(p => p.id === formData.plan_id)
    const selectedVehicles = getSelectedVehicles()
    
    const vehiclesSection = selectedVehicles.length > 0
      ? `VEÍCULOS COBERTOS:\n${selectedVehicles.map((v, i) => `${i + 1}. ${v.license_plate} - ${v.brand} ${v.model}`).join('\n')}`
      : ''
    
    return `
CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: ${client.name}
E-mail: ${client.email}
Telefone: ${client.phone}
Documento: ${client.document || 'Não informado'}

CONTRATADA: ${companyInfo?.name || '[Nome da Empresa]'}
CNPJ: ${companyInfo?.cnpj || '[CNPJ]'}
Endereço: ${companyInfo?.address || '[Endereço]'}
Responsável: ${companyInfo?.ownerName || '[Responsável]'}

PLANO: ${selectedPlan?.name || 'Não especificado'}
VALOR MENSAL: R$ ${formData.monthly_value.toFixed(2)}

${vehiclesSection}

VIGÊNCIA: ${format(formData.start_date, 'dd/MM/yyyy')} ${formData.end_date ? `até ${format(formData.end_date, 'dd/MM/yyyy')}` : '(prazo indeterminado)'}

TIPO DE CONTRATO: ${formData.contract_type === 'service' ? 'Prestação de Serviços' : formData.contract_type === 'rental' ? 'Locação' : 'Manutenção'}

Este contrato estabelece os termos e condições para a prestação dos serviços contratados.

_________________________________
Assinatura do Contratante

_________________________________
${companyInfo?.ownerName || '[Responsável]'}
${companyInfo?.name || '[Nome da Empresa]'}
Contratada
    `
  }

  const getPreviewData = () => {
    const selectedClient = clients.find(c => c.id === formData.client_id)
    const selectedPlan = plans.find(p => p.id === formData.plan_id)
    const selectedVehicles = getSelectedVehicles()
    const selectedTemplate = templates.find(t => t.id === formData.template_id)

    const vehiclesInfo = selectedVehicles.length > 0
      ? selectedVehicles.map(v => `${v.license_plate} - ${v.brand} ${v.model}`).join(', ')
      : 'Não aplicável'

    const defaultTemplate = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: {{cliente_nome}}
E-mail: {{cliente_email}}
Telefone: {{cliente_telefone}}
Documento: {{cliente_documento}}

CONTRATADA: {{empresa_razao_social}}
CNPJ: {{empresa_cnpj}}
Endereço: {{empresa_endereco}}
Responsável: {{empresa_responsavel}}

OBJETO DO CONTRATO:
A contratada se compromete a prestar os seguintes serviços:

PLANO: {{plano_nome}}
VALOR MENSAL: {{valor_mensal}}
VEÍCULO(S): {{veiculo_info}}

VIGÊNCIA: {{data_inicio}} {{data_fim}}

CLÁUSULAS:

1. DO PAGAMENTO
O pagamento será efetuado mensalmente, no valor de {{valor_mensal}}, até o dia 10 de cada mês.

2. DA VIGÊNCIA
Este contrato terá vigência de {{data_inicio}} {{data_fim}}.

3. DAS RESPONSABILIDADES
A contratada se responsabiliza pela prestação dos serviços conforme especificado.

4. DA RESCISÃO
Este contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 30 dias.

LOCAL E DATA: ________________, ____ de ____________ de ______

_________________________________
{{cliente_nome}}
Contratante

_________________________________
{{empresa_responsavel}}
{{empresa_razao_social}}
Contratada`

    return {
      clientName: selectedClient?.name || '',
      clientEmail: selectedClient?.email || '',
      clientPhone: selectedClient?.phone || '',
      clientDocument: selectedClient?.document || '',
      planName: selectedPlan?.name || '',
      monthlyValue: formData.monthly_value,
      vehicleInfo: vehiclesInfo,
      startDate: formData.start_date,
      endDate: formData.end_date,
      companyName: companyInfo?.name || '',
      companyCnpj: companyInfo?.cnpj || '',
      companyAddress: companyInfo?.address || '',
      companyOwner: companyInfo?.ownerName || '',
      templateContent: selectedTemplate?.content || defaultTemplate
    }
  }

  const handlePreview = () => {
    if (!formData.client_id) {
      toast({
        title: "Cliente não selecionado",
        description: "Selecione um cliente para visualizar o contrato",
        variant: "destructive"
      })
      return
    }
    if (!formData.plan_id) {
      toast({
        title: "Plano não selecionado",
        description: "Selecione um plano para visualizar o contrato",
        variant: "destructive"
      })
      return
    }
    setShowPreview(true)
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

    // Usar contexto cacheado para evitar requisições extras
    if (!userContext?.companyId) {
      toast({
        title: "Erro de sessão",
        description: "Recarregue a página e tente novamente",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      const contractData = {
        client_id: formData.client_id,
        plan_id: formData.plan_id,
        vehicle_id: null, // Deprecated - usando contract_vehicles agora
        monthly_value: formData.monthly_value,
        start_date: formData.start_date.toISOString().split('T')[0],
        end_date: formData.end_date ? formData.end_date.toISOString().split('T')[0] : null,
        contract_type: formData.contract_type,
        company_id: userContext.companyId,
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

        // Atualizar veículos: remover antigos e inserir novos
        await supabase
          .from('contract_vehicles')
          .delete()
          .eq('contract_id', contractId)

        if (formData.vehicle_ids.length > 0) {
          const { error: vehiclesError } = await supabase
            .from('contract_vehicles')
            .insert(formData.vehicle_ids.map(vid => ({
              contract_id: contractId,
              vehicle_id: vid
            })))
          
          if (vehiclesError) throw vehiclesError
        }
      } else {
        // Criar novo contrato
        const { data, error } = await supabase
          .from('contracts')
          .insert(contractData)
          .select()
          .single()
        
        if (error) throw error;
        result = data;

        // Inserir veículos relacionados
        if (formData.vehicle_ids.length > 0) {
          const { error: vehiclesError } = await supabase
            .from('contract_vehicles')
            .insert(formData.vehicle_ids.map(vid => ({
              contract_id: result.id,
              vehicle_id: vid
            })))
          
          if (vehiclesError) throw vehiclesError
        }
      }

      console.log('✅ Contrato salvo com sucesso:', result);

      toast({
        title: contractId ? "Contrato atualizado" : "Contrato criado",
        description: "Operação realizada com sucesso!"
      })

      // Se for novo contrato, perguntar se quer enviar para assinatura
      if (!contractId && result) {
        const shouldSend = window.confirm("Deseja enviar este contrato para assinatura eletrônica?")
        if (shouldSend) {
          // Mostrar feedback imediato e processar em background
          toast({
            title: "Processando...",
            description: "Enviando contrato para assinatura. Você será notificado.",
          })
          
          // Fechar modal imediatamente e processar assinatura em background
          setLoading(false)
          onSuccess?.()
          
          // Executar envio em background (não bloqueia)
          sendForSignature(result.id).catch(error => {
            console.error('Erro ao enviar para assinatura em background:', error)
          })
          return
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

  // Calcular valor sugerido
  const selectedPlan = plans.find(p => p.id === formData.plan_id)
  const vehicleCount = formData.vehicle_ids.length || 1
  const suggestedValue = selectedPlan ? selectedPlan.price * vehicleCount : 0

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
          Crie contratos digitais com assinatura eletrônica via Assinafy
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
              </div>

              {/* Seleção múltipla de veículos */}
              {formData.client_id && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Veículos do Contrato
                    {formData.vehicle_ids.length > 0 && (
                      <Badge variant="secondary">{formData.vehicle_ids.length} selecionado(s)</Badge>
                    )}
                  </Label>
                  <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2 bg-muted/30">
                    {filteredVehicles.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Nenhum veículo cadastrado para este cliente
                      </p>
                    ) : (
                      filteredVehicles.map((vehicle) => (
                        <div 
                          key={vehicle.id} 
                          className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            id={`vehicle-${vehicle.id}`}
                            checked={formData.vehicle_ids.includes(vehicle.id)}
                            onCheckedChange={(checked) => handleVehicleToggle(vehicle.id, checked as boolean)}
                          />
                          <label 
                            htmlFor={`vehicle-${vehicle.id}`}
                            className="text-sm font-medium leading-none cursor-pointer flex-1"
                          >
                            <span className="font-semibold">{vehicle.license_plate}</span>
                            <span className="text-muted-foreground ml-2">
                              {vehicle.brand} {vehicle.model}
                            </span>
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selecione os veículos que serão cobertos por este contrato
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="template_id">Modelo de Contrato *</Label>
                  <Select 
                    value={formData.template_id || ""}
                    onValueChange={(value) => setFormData({...formData, template_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o modelo de contrato" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Selecione um modelo para gerar o contrato
                  </p>
                </div>
                <div>
                  <Label htmlFor="monthly_value">Valor Mensal *</Label>
                  <Input
                    id="monthly_value"
                    type="number"
                    onWheel={preventWheelChange}
                    step="0.01"
                    min="0"
                    value={formData.monthly_value || ''}
                    onChange={(e) => setFormData({...formData, monthly_value: parseFloat(e.target.value) || 0})}
                    onBlur={(e) => {
                      const rounded = Math.round((parseFloat(e.target.value) || 0) * 100) / 100
                      if (rounded !== formData.monthly_value) {
                        setFormData({...formData, monthly_value: rounded})
                      }
                    }}
                    className={errors.monthly_value ? "border-destructive" : ""}
                    required
                  />
                  {selectedPlan && formData.vehicle_ids.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Sugerido: R$ {suggestedValue.toFixed(2)} ({vehicleCount} veículo(s) × R$ {selectedPlan.price.toFixed(2)})
                    </p>
                  )}
                  {selectedPlan && formData.vehicle_ids.length > 0 && formData.monthly_value > 0 &&
                    Math.abs(formData.monthly_value - suggestedValue) > 0.001 && (
                    <p className="text-xs text-amber-600 mt-1">
                      Atenção: valor digitado difere do sugerido em R$ {Math.abs(formData.monthly_value - suggestedValue).toFixed(2)}. Confirme se está correto antes de salvar.
                    </p>
                  )}

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
                        className="p-3 pointer-events-auto"
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
                          setFormData({...formData, end_date: date || null})
                          setErrors({...errors, end_date: ""})
                        }}
                        disabled={(date) => date <= formData.start_date}
                        initialFocus
                        className="p-3 pointer-events-auto"
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
                <Button 
                  type="button"
                  variant="outline"
                  onClick={handlePreview}
                  disabled={loading}
                  className="gap-2 flex-1 sm:flex-none"
                >
                  <Eye className="h-4 w-4" />
                  Pré-visualizar
                </Button>
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

      <ContractPreview
        open={showPreview}
        onOpenChange={setShowPreview}
        contractData={getPreviewData()}
      />
    </Card>
  )
}