import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Send, History, FileText, AlertCircle, CheckCircle, Clock, QrCode, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import QRCode from 'qrcode'

interface WhatsAppConfig {
  instanceUrl: string
  authToken: string
  instanceName: string
  enableLogs: boolean
  enableDeliveryStatus: boolean
  isConnected: boolean
}

interface MessageTemplate {
  id: string
  name: string
  content: string
  variables: string[]
}

interface MessageLog {
  id: string
  to: string
  message: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: Date
  template?: string
}

interface QRCodeData {
  qrCode: string
  pairingCode?: string
  base64?: string
}

const WhatsAppIntegration = () => {
  const { toast } = useToast()
  const [config, setConfig] = useState<WhatsAppConfig>({
    instanceUrl: "",
    authToken: "",
    instanceName: "",
    enableLogs: true,
    enableDeliveryStatus: true,
    isConnected: false
  })
  const [loading, setLoading] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [companyId, setCompanyId] = useState<string>("")
  const [qrCodeData, setQrCodeData] = useState<QRCodeData | null>(null)
  const [qrCodeImage, setQrCodeImage] = useState<string>("")
  const [isGeneratingQR, setIsGeneratingQR] = useState(false)
  const connectionCheckInterval = useRef<NodeJS.Timeout | null>(null)

  const [templates, setTemplates] = useState<MessageTemplate[]>([
    {
      id: "1",
      name: "Cobrança Vencimento",
      content: "Olá {nome}, seu pagamento de R$ {valor} venceu em {vencimento}. Clique aqui para pagar: {link_pagamento}",
      variables: ["nome", "valor", "vencimento", "link_pagamento"]
    },
    {
      id: "2", 
      name: "Lembrete Vencimento",
      content: "Olá {nome}, lembramos que seu pagamento de R$ {valor} vence em {vencimento}. Link: {link_pagamento}",
      variables: ["nome", "valor", "vencimento", "link_pagamento"]
    }
  ])

  const [newTemplate, setNewTemplate] = useState({
    name: "",
    content: ""
  })

  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([])

  useEffect(() => {
    loadSettings()
    loadLogs()
    
    // Cleanup interval on unmount
    return () => {
      if (connectionCheckInterval.current) {
        clearInterval(connectionCheckInterval.current)
      }
    }
  }, [])

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsLoadingProfile(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (profileError) {
        console.error('Erro ao buscar perfil:', profileError)
        setIsLoadingProfile(false)
        return
      }

      if (!profile || !profile.company_id) {
        console.error('Perfil não encontrado ou company_id não definido:', profile)
        toast({
          title: "Erro",
          description: "Perfil da empresa não encontrado. Entre em contato com o suporte.",
          variant: "destructive"
        })
        setIsLoadingProfile(false)
        return
      }
      
      setCompanyId(profile.company_id)
      setIsLoadingProfile(false)

      const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('company_id', profile.company_id)
        .single()

      if (settings) {
        setConfig({
          instanceUrl: settings.instance_url,
          authToken: settings.api_token,
          instanceName: settings.instance_name,
          enableLogs: settings.enable_logs,
          enableDeliveryStatus: settings.enable_delivery_status,
          isConnected: settings.connection_status === 'connected'
        })
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
    }
  }

  const loadLogs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile) return

      const { data: logs } = await supabase
        .from('whatsapp_logs')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (logs) {
        const formattedLogs = logs.map(log => ({
          id: log.id,
          to: log.phone_number,
          message: log.message_content,
          status: log.status as 'sent' | 'delivered' | 'read' | 'failed',
          timestamp: new Date(log.created_at),
          template: log.template_name || undefined
        }))
        setMessageLogs(formattedLogs)
      }
    } catch (error) {
      console.error('Erro ao carregar logs:', error)
    }
  }

  const [manualMessage, setManualMessage] = useState({
    phone: "",
    message: "",
    selectedTemplate: ""
  })

  const handleConfigChange = (field: keyof WhatsAppConfig, value: string | boolean) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const handleGenerateQRCode = async () => {
    if (!config.instanceUrl || !config.authToken || !config.instanceName) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      })
      return
    }

    setIsGeneratingQR(true)
    try {
      const response = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'get_qr_code',
          instance_url: config.instanceUrl,
          api_token: config.authToken,
          instance_name: config.instanceName
        }
      })

      if (response.data?.success && response.data?.qrCode) {
        setQrCodeData(response.data)
        
        // Gerar QR Code image
        const qrImageUrl = await QRCode.toDataURL(response.data.qrCode, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000',
            light: '#FFF'
          }
        })
        setQrCodeImage(qrImageUrl)

        // Iniciar verificação automática de conexão
        startConnectionCheck()

        toast({
          title: "QR Code gerado",
          description: "Escaneie o código QR com seu WhatsApp para conectar!"
        })
      } else {
        throw new Error(response.data?.error || 'Falha ao gerar QR Code')
      }
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error)
      toast({
        title: "Erro",
        description: "Erro ao gerar QR Code. Verifique suas credenciais.",
        variant: "destructive"
      })
    } finally {
      setIsGeneratingQR(false)
    }
  }

  const startConnectionCheck = () => {
    // Limpar interval existente
    if (connectionCheckInterval.current) {
      clearInterval(connectionCheckInterval.current)
    }

    // Verificar conexão a cada 5 segundos
    connectionCheckInterval.current = setInterval(async () => {
      try {
        const response = await supabase.functions.invoke('whatsapp-evolution', {
          body: {
            action: 'check_connection',
            instance_url: config.instanceUrl,
            api_token: config.authToken,
            instance_name: config.instanceName
          }
        })

        if (response.data?.connected) {
          setConfig(prev => ({ ...prev, isConnected: true }))
          setQrCodeData(null)
          setQrCodeImage("")
          
          // Atualizar status no banco
          if (companyId) {
            await supabase
              .from('whatsapp_settings')
              .upsert({
                company_id: companyId,
                instance_url: config.instanceUrl,
                instance_name: config.instanceName,
                api_token: config.authToken,
                enable_logs: config.enableLogs,
                enable_delivery_status: config.enableDeliveryStatus,
                connection_status: 'connected'
              })
          }

          // Parar verificação
          if (connectionCheckInterval.current) {
            clearInterval(connectionCheckInterval.current)
          }

          toast({
            title: "Conectado!",
            description: "WhatsApp conectado com sucesso!",
          })
        }
      } catch (error) {
        console.error('Erro ao verificar conexão:', error)
      }
    }, 5000)
  }

  const handleTestConnection = async () => {
    if (!config.instanceUrl || !config.authToken || !config.instanceName) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const response = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'check_connection',
          instance_url: config.instanceUrl,
          api_token: config.authToken,
          instance_name: config.instanceName
        }
      })

      if (response.data?.connected) {
        setConfig(prev => ({ ...prev, isConnected: true }))
        
        // Atualizar status no banco
        if (companyId) {
          await supabase
            .from('whatsapp_settings')
            .upsert({
              company_id: companyId,
              instance_url: config.instanceUrl,
              instance_name: config.instanceName,
              api_token: config.authToken,
              enable_logs: config.enableLogs,
              enable_delivery_status: config.enableDeliveryStatus,
              connection_status: 'connected'
            })
        }

        toast({
          title: "Sucesso",
          description: "Conexão com WhatsApp Evolution estabelecida com sucesso!"
        })
      } else {
        setConfig(prev => ({ ...prev, isConnected: false }))
        const stateConn = response.data?.state || 'unknown'
        toast({
          title: "Instância desconectada",
          description: stateConn === 'close' 
            ? "Gerando QR Code para conectar..."
            : "Não foi possível confirmar a conexão. Confira as credenciais ou gere o QR Code.",
        })
        if (stateConn === 'close') {
          await handleGenerateQRCode()
        }
      }
    } catch (error) {
      console.error('Erro ao testar conexão:', error)
      toast({
        title: "Erro",
        description: "Falha ao conectar com WhatsApp Evolution. Verifique suas credenciais.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async () => {
    if (isLoadingProfile) {
      toast({
        title: "Aguarde",
        description: "Carregando dados do perfil...",
        variant: "default"
      })
      return
    }

    if (!companyId) {
      toast({
        title: "Erro",
        description: "Erro ao identificar empresa. Atualize a página e tente novamente.",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('whatsapp_settings')
        .upsert({
          company_id: companyId,
          instance_url: config.instanceUrl,
          instance_name: config.instanceName,
          api_token: config.authToken,
          enable_logs: config.enableLogs,
          enable_delivery_status: config.enableDeliveryStatus,
          connection_status: config.isConnected ? 'connected' : 'disconnected'
        })

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Configurações salvas com segurança!"
      })
    } catch (error) {
      console.error('Erro ao salvar configurações:', error)
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = () => {
    if (!newTemplate.name || !newTemplate.content) {
      toast({
        title: "Erro",
        description: "Preencha nome e conteúdo do template",
        variant: "destructive"
      })
      return
    }

    const variables = newTemplate.content.match(/{([^}]+)}/g)?.map(v => v.slice(1, -1)) || []
    
    const template: MessageTemplate = {
      id: Date.now().toString(),
      name: newTemplate.name,
      content: newTemplate.content,
      variables
    }

    setTemplates(prev => [...prev, template])
    setNewTemplate({ name: "", content: "" })
    toast({
      title: "Sucesso",
      description: "Template criado com sucesso!"
    })
  }

  const handleSendManualMessage = async () => {
    if (!manualMessage.phone || !manualMessage.message) {
      toast({
        title: "Erro",
        description: "Preencha telefone e mensagem",
        variant: "destructive"
      })
      return
    }

    if (!config.isConnected) {
      toast({
        title: "Erro",
        description: "WhatsApp não está conectado",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const response = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'send_message',
          instance_url: config.instanceUrl,
          api_token: config.authToken,
          instance_name: config.instanceName,
          phone_number: manualMessage.phone,
          message: manualMessage.message,
          company_id: companyId
        }
      })

      if (response.data?.success) {
        toast({
          title: "Sucesso",
          description: "Mensagem enviada com sucesso!"
        })
        setManualMessage({ phone: "", message: "", selectedTemplate: "" })
        loadLogs() // Recarregar logs
      } else {
        throw new Error(response.data?.error || 'Falha ao enviar mensagem')
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagem",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setManualMessage(prev => ({ 
        ...prev, 
        message: template.content,
        selectedTemplate: template.name
      }))
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Clock className="w-4 h-4 text-blue-500" />
      case 'delivered': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'read': return <CheckCircle className="w-4 h-4 text-green-600 fill-green-100" />
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />
      default: return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sent': return 'Enviada'
      case 'delivered': return 'Entregue'
      case 'read': return 'Lida'
      case 'failed': return 'Falhou'
      default: return 'Pendente'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-6 h-6 text-green-600" />
        <h2 className="text-2xl font-bold">Integração WhatsApp Evolution</h2>
        {config.isConnected && (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Conectado
          </Badge>
        )}
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="send">Enviar Mensagem</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Credenciais WhatsApp Evolution</CardTitle>
              <CardDescription>
                Configure suas credenciais para integração com a API WhatsApp Evolution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="instanceUrl">URL da Instância Evolution *</Label>
                  <Input
                    id="instanceUrl"
                    placeholder="https://api.evolution.com.br"
                    value={config.instanceUrl}
                    onChange={(e) => handleConfigChange('instanceUrl', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instanceName">Nome da Instância *</Label>
                  <Input
                    id="instanceName"
                    placeholder="minha-instancia"
                    value={config.instanceName}
                    onChange={(e) => handleConfigChange('instanceName', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="authToken">Token de Autenticação *</Label>
                <Input
                  id="authToken"
                  type="password"
                  placeholder="seu-token-secreto"
                  value={config.authToken}
                  onChange={(e) => handleConfigChange('authToken', e.target.value)}
                />
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Habilitar Logs de Mensagens</Label>
                    <p className="text-sm text-muted-foreground">
                      Registrar todas as mensagens enviadas, entregues, lidas e recebidas
                    </p>
                  </div>
                  <Switch
                    checked={config.enableLogs}
                    onCheckedChange={(checked) => handleConfigChange('enableLogs', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Status de Entrega</Label>
                    <p className="text-sm text-muted-foreground">
                      Mostrar se a mensagem foi enviada, entregue e lida
                    </p>
                  </div>
                  <Switch
                    checked={config.enableDeliveryStatus}
                    onCheckedChange={(checked) => handleConfigChange('enableDeliveryStatus', checked)}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleTestConnection} variant="outline" disabled={loading}>
                  {loading ? "Testando..." : "Testar Conexão"}
                </Button>
                <Button onClick={handleSaveConfig} disabled={loading}>
                  {loading ? "Salvando..." : "Salvar Configurações"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* QR Code Section */}
          {!config.isConnected && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="w-5 h-5" />
                  Conectar WhatsApp
                </CardTitle>
                <CardDescription>
                  Gere um QR Code para conectar sua instância WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!qrCodeImage ? (
                  <div className="text-center space-y-4">
                    <div className="p-8 border-2 border-dashed rounded-lg">
                      <QrCode className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">
                        Clique no botão abaixo para gerar o QR Code e conectar seu WhatsApp
                      </p>
                      <Button 
                        onClick={handleGenerateQRCode} 
                        disabled={isGeneratingQR || !config.instanceUrl || !config.authToken || !config.instanceName}
                      >
                        {isGeneratingQR ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Gerando QR Code...
                          </>
                        ) : (
                          <>
                            <QrCode className="w-4 h-4 mr-2" />
                            Gerar QR Code
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="p-4 border rounded-lg bg-white inline-block">
                      <img 
                        src={qrCodeImage} 
                        alt="QR Code WhatsApp" 
                        className="w-64 h-64 mx-auto"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium">Escaneie o QR Code com seu WhatsApp</p>
                      <p className="text-sm text-muted-foreground">
                        1. Abra o WhatsApp no seu celular<br/>
                        2. Toque nos três pontos no canto superior direito<br/>
                        3. Selecione "WhatsApp Web"<br/>
                        4. Escaneie este código QR
                      </p>
                      {qrCodeData?.pairingCode && (
                        <div className="mt-4 p-3 bg-muted rounded-lg">
                          <p className="text-sm font-medium">Código de Pareamento:</p>
                          <p className="text-lg font-mono tracking-wider">{qrCodeData.pairingCode}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button 
                        onClick={handleGenerateQRCode} 
                        variant="outline"
                        disabled={isGeneratingQR}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Gerar Novo QR
                      </Button>
                      <Button 
                        onClick={handleTestConnection} 
                        variant="outline"
                        disabled={loading}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Verificar Conexão
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Templates de Mensagens
              </CardTitle>
              <CardDescription>
                Crie templates personalizados com variáveis para automatizar suas mensagens
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium">Criar Novo Template</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Template</Label>
                    <Input
                      placeholder="Ex: Cobrança Vencimento"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Conteúdo da Mensagem</Label>
                  <Textarea
                    placeholder="Use variáveis como {nome}, {valor}, {vencimento}, {link_pagamento}"
                    value={newTemplate.content}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Variáveis disponíveis: {'{nome}'}, {'{valor}'}, {'{vencimento}'}, {'{link_pagamento}'}, {'{empresa}'}
                  </p>
                </div>
                <Button onClick={handleCreateTemplate}>Criar Template</Button>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Templates Existentes</h4>
                {templates.map((template) => (
                  <div key={template.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium">{template.name}</h5>
                      <Button variant="outline" size="sm">Editar</Button>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{template.content}</p>
                    <div className="flex flex-wrap gap-1">
                      {template.variables.map((variable) => (
                        <Badge key={variable} variant="secondary" className="text-xs">
                          {'{' + variable + '}'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="send" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Enviar Mensagem Manual
              </CardTitle>
              <CardDescription>
                Envie mensagens manuais usando templates ou texto livre
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número do WhatsApp</Label>
                  <Input
                    placeholder="+5511999999999"
                    value={manualMessage.phone}
                    onChange={(e) => setManualMessage(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Usar Template</Label>
                  <select
                    className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md"
                    value={manualMessage.selectedTemplate}
                    onChange={(e) => {
                      setManualMessage(prev => ({ ...prev, selectedTemplate: e.target.value }))
                      if (e.target.value) {
                        const template = templates.find(t => t.name === e.target.value)
                        if (template) applyTemplate(template.id)
                      }
                    }}
                  >
                    <option value="">Selecione um template...</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.name}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  placeholder="Digite sua mensagem..."
                  value={manualMessage.message}
                  onChange={(e) => setManualMessage(prev => ({ ...prev, message: e.target.value }))}
                  rows={4}
                />
              </div>

              <Button onClick={handleSendManualMessage} disabled={!config.isConnected || loading}>
                {loading ? "Enviando..." : "Enviar Mensagem"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Logs de Mensagens
              </CardTitle>
              <CardDescription>
                Histórico de todas as mensagens enviadas e recebidas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {config.enableLogs ? (
                <div className="space-y-4">
                  {messageLogs.map((log) => (
                    <div key={log.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{log.to}</span>
                          {log.template && (
                            <Badge variant="outline" className="text-xs">
                              {log.template}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {config.enableDeliveryStatus && (
                            <div className="flex items-center gap-1">
                              {getStatusIcon(log.status)}
                              <span>{getStatusText(log.status)}</span>
                            </div>
                          )}
                          <span>{log.timestamp.toLocaleString()}</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{log.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Logs de mensagens estão desabilitados</p>
                  <p className="text-sm">Ative na aba Configuração para ver o histórico</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default WhatsAppIntegration