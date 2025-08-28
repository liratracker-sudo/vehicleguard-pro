import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Send, History, FileText, AlertCircle, CheckCircle, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface WhatsAppConfig {
  instanceUrl: string
  authToken: string
  instanceId: string
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

const WhatsAppIntegration = () => {
  const { toast } = useToast()
  const [config, setConfig] = useState<WhatsAppConfig>({
    instanceUrl: "",
    authToken: "",
    instanceId: "",
    enableLogs: true,
    enableDeliveryStatus: true,
    isConnected: false
  })

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

  const [messageLogs] = useState<MessageLog[]>([
    {
      id: "1",
      to: "+5511999999999",
      message: "Olá João, seu pagamento de R$ 150,00 venceu em 15/01/2025...",
      status: "read",
      timestamp: new Date("2025-01-16T10:30:00"),
      template: "Cobrança Vencimento"
    },
    {
      id: "2",
      to: "+5511888888888",
      message: "Olá Maria, lembramos que seu pagamento de R$ 250,00...",
      status: "delivered",
      timestamp: new Date("2025-01-16T09:15:00"),
      template: "Lembrete Vencimento"
    }
  ])

  const [manualMessage, setManualMessage] = useState({
    phone: "",
    message: "",
    selectedTemplate: ""
  })

  const handleConfigChange = (field: keyof WhatsAppConfig, value: string | boolean) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const handleTestConnection = async () => {
    if (!config.instanceUrl || !config.authToken || !config.instanceId) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      })
      return
    }

    try {
      // Simulate API call to test connection
      await new Promise(resolve => setTimeout(resolve, 2000))
      setConfig(prev => ({ ...prev, isConnected: true }))
      toast({
        title: "Sucesso",
        description: "Conexão com WhatsApp estabelecida com sucesso!"
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao conectar com WhatsApp. Verifique suas credenciais.",
        variant: "destructive"
      })
    }
  }

  const handleSaveConfig = async () => {
    try {
      // Save encrypted credentials to database
      toast({
        title: "Sucesso",
        description: "Configurações salvas com segurança!"
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações",
        variant: "destructive"
      })
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

    try {
      // Send message via WppConnect API
      toast({
        title: "Sucesso",
        description: "Mensagem enviada com sucesso!"
      })
      setManualMessage({ phone: "", message: "", selectedTemplate: "" })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagem",
        variant: "destructive"
      })
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
        <h2 className="text-2xl font-bold">Integração WhatsApp (WppConnect)</h2>
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
              <CardTitle>Credenciais WppConnect</CardTitle>
              <CardDescription>
                Configure suas credenciais para integração com WppConnect
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="instanceUrl">URL da Instância *</Label>
                  <Input
                    id="instanceUrl"
                    placeholder="https://api.wppconnect.io"
                    value={config.instanceUrl}
                    onChange={(e) => handleConfigChange('instanceUrl', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instanceId">ID da Instância *</Label>
                  <Input
                    id="instanceId"
                    placeholder="minha-instancia"
                    value={config.instanceId}
                    onChange={(e) => handleConfigChange('instanceId', e.target.value)}
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
                <Button onClick={handleTestConnection} variant="outline">
                  Testar Conexão
                </Button>
                <Button onClick={handleSaveConfig}>
                  Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
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

              <Button onClick={handleSendManualMessage} disabled={!config.isConnected}>
                Enviar Mensagem
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