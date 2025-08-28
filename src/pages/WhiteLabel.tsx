import { useState } from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Upload,
  Palette,
  Globe,
  MessageSquare,
  Settings,
  Eye,
  Save,
  Smartphone,
  CreditCard,
  Building2,
  Key
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const WhiteLabelPage = () => {
  const [branding, setBranding] = useState({
    companyName: "VehicleGuard Pro",
    logo: "",
    primaryColor: "#3b82f6",
    secondaryColor: "#f8fafc",
    accentColor: "#10b981",
    domain: "app.vehicleguard.com.br",
    favicon: ""
  })

  const [integrations, setIntegrations] = useState({
    cora: { enabled: false, apiKey: "", environment: "sandbox" },
    asaas: { enabled: false, apiKey: "", environment: "sandbox" },
    mercadoPago: { enabled: false, publicKey: "", accessToken: "", environment: "sandbox" },
    efi: { enabled: false, clientId: "", clientSecret: "", environment: "sandbox" },
    whatsapp: { enabled: false, instanceId: "", token: "" }
  })

  const [messages, setMessages] = useState({
    welcome: "Bem-vindo ao {company_name}! Seu veículo está protegido conosco.",
    paymentReminder: "Olá {client_name}, sua fatura de R$ {amount} vence em {days} dias. Pague em: {payment_link}",
    paymentConfirmation: "Pagamento confirmado! Obrigado {client_name}. Seu serviço continua ativo.",
    suspension: "Seu serviço foi suspenso por falta de pagamento. Regularize em: {payment_link}",
    reactivation: "Serviço reativado! Seu veículo já está sendo monitorado novamente."
  })

  const handleBrandingChange = (field: string, value: string) => {
    setBranding(prev => ({ ...prev, [field]: value }))
  }

  const handleIntegrationChange = (provider: string, field: string, value: any) => {
    setIntegrations(prev => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value }
    }))
  }

  const handleMessageChange = (type: string, value: string) => {
    setMessages(prev => ({ ...prev, [type]: value }))
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">White Label</h1>
            <p className="text-muted-foreground">
              Configure a identidade visual e integrações da sua empresa
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Eye className="w-4 h-4 mr-2" />
              Pré-visualizar
            </Button>
            <Button>
              <Save className="w-4 h-4 mr-2" />
              Salvar Alterações
            </Button>
          </div>
        </div>

        <Tabs defaultValue="branding" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="branding">Identidade</TabsTrigger>
            <TabsTrigger value="domain">Domínio</TabsTrigger>
            <TabsTrigger value="integrations">Integrações</TabsTrigger>
            <TabsTrigger value="messages">Mensagens</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Identidade Visual
                  </CardTitle>
                  <CardDescription>
                    Configure logotipo, cores e elementos visuais
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Nome da Empresa</Label>
                    <Input
                      id="companyName"
                      value={branding.companyName}
                      onChange={(e) => handleBrandingChange('companyName', e.target.value)}
                      placeholder="Sua Empresa Ltda"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Logotipo</Label>
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                      <div className="text-center">
                        <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                        <div className="mt-4">
                          <Button variant="outline">
                            Fazer Upload do Logo
                          </Button>
                          <p className="text-sm text-muted-foreground mt-2">
                            PNG, JPG até 2MB. Recomendado: 200x60px
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primaryColor">Cor Primária</Label>
                      <div className="flex gap-2">
                        <div 
                          className="w-10 h-10 rounded border"
                          style={{ backgroundColor: branding.primaryColor }}
                        />
                        <Input
                          id="primaryColor"
                          type="color"
                          value={branding.primaryColor}
                          onChange={(e) => handleBrandingChange('primaryColor', e.target.value)}
                          className="w-20"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondaryColor">Cor Secundária</Label>
                      <div className="flex gap-2">
                        <div 
                          className="w-10 h-10 rounded border"
                          style={{ backgroundColor: branding.secondaryColor }}
                        />
                        <Input
                          id="secondaryColor"
                          type="color"
                          value={branding.secondaryColor}
                          onChange={(e) => handleBrandingChange('secondaryColor', e.target.value)}
                          className="w-20"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accentColor">Cor de Destaque</Label>
                      <div className="flex gap-2">
                        <div 
                          className="w-10 h-10 rounded border"
                          style={{ backgroundColor: branding.accentColor }}
                        />
                        <Input
                          id="accentColor"
                          type="color"
                          value={branding.accentColor}
                          onChange={(e) => handleBrandingChange('accentColor', e.target.value)}
                          className="w-20"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pré-visualização</CardTitle>
                  <CardDescription>
                    Veja como ficará sua marca aplicada
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div 
                    className="rounded-lg p-6 border-2"
                    style={{ 
                      background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.accentColor})`,
                      color: 'white'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{branding.companyName}</h3>
                        <p className="text-sm opacity-90">Sistema de Rastreamento</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-white/10 rounded p-3">
                        <p className="text-sm">Dashboard</p>
                      </div>
                      <div className="bg-white/10 rounded p-3">
                        <p className="text-sm">Clientes</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="domain" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Configuração de Domínio
                </CardTitle>
                <CardDescription>
                  Configure seu domínio personalizado
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domínio Personalizado</Label>
                  <Input
                    id="domain"
                    value={branding.domain}
                    onChange={(e) => handleBrandingChange('domain', e.target.value)}
                    placeholder="app.suaempresa.com.br"
                  />
                  <p className="text-sm text-muted-foreground">
                    Configure um CNAME apontando para: vehicleguard-pro.app
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-primary-light">
                  <h4 className="font-medium mb-2">Instruções de Configuração DNS</h4>
                  <ol className="text-sm space-y-2 list-decimal list-inside">
                    <li>Acesse o painel de controle do seu provedor de domínio</li>
                    <li>Adicione um registro CNAME:</li>
                    <ul className="ml-4 mt-1 space-y-1">
                      <li>• Nome: app (ou subdomínio desejado)</li>
                      <li>• Valor: vehicleguard-pro.app</li>
                    </ul>
                    <li>Aguarde a propagação (até 24h)</li>
                    <li>Clique em "Verificar Domínio" abaixo</li>
                  </ol>
                </div>

                <div className="flex gap-2">
                  <Button>Verificar Domínio</Button>
                  <Button variant="outline">Testar Configuração</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <div className="grid gap-6">
              {/* Payment Gateways */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Gateways de Pagamento
                  </CardTitle>
                  <CardDescription>
                    Configure as integrações bancárias para cobrança
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(integrations).filter(([key]) => key !== 'whatsapp').map(([provider, config]) => (
                    <div key={provider} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium capitalize">
                          {provider === 'mercadoPago' ? 'Mercado Pago' : provider}
                        </h4>
                        <Switch
                          checked={config.enabled}
                          onCheckedChange={(checked) => 
                            handleIntegrationChange(provider, 'enabled', checked)
                          }
                        />
                      </div>
                      
                      {config.enabled && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            {'environment' in config && (
                              <div className="space-y-2">
                                <Label>Ambiente</Label>
                                <Select
                                  value={config.environment || "sandbox"}
                                  onValueChange={(value) => 
                                    handleIntegrationChange(provider, 'environment', value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="sandbox">Sandbox (Teste)</SelectItem>
                                    <SelectItem value="production">Produção</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            <div className="space-y-2">
                              <Label>Chave da API</Label>
                              <Input
                                type="password"
                                value={('apiKey' in config) ? config.apiKey || '' : ''}
                                onChange={(e) => 
                                  handleIntegrationChange(provider, 'apiKey', e.target.value)
                                }
                                placeholder="Sua chave da API"
                              />
                            </div>
                          </div>
                          
                          {provider === 'mercadoPago' && 'accessToken' in config && (
                            <div className="space-y-2">
                              <Label>Access Token</Label>
                              <Input
                                type="password"
                                value={config.accessToken || ''}
                                onChange={(e) => 
                                  handleIntegrationChange(provider, 'accessToken', e.target.value)
                                }
                                placeholder="Access Token"
                              />
                            </div>
                          )}
                          
                          <Button variant="outline" size="sm">
                            Testar Conexão
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* WhatsApp Integration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5" />
                    WhatsApp Business
                  </CardTitle>
                  <CardDescription>
                    Configure o envio de mensagens via WhatsApp
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">WhatsApp API</h4>
                    <Switch
                      checked={integrations.whatsapp.enabled}
                      onCheckedChange={(checked) => 
                        handleIntegrationChange('whatsapp', 'enabled', checked)
                      }
                    />
                  </div>
                  
                  {integrations.whatsapp.enabled && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Instance ID</Label>
                          <Input
                            value={integrations.whatsapp.instanceId}
                            onChange={(e) => 
                              handleIntegrationChange('whatsapp', 'instanceId', e.target.value)
                            }
                            placeholder="Seu Instance ID"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Token</Label>
                          <Input
                            type="password"
                            value={integrations.whatsapp.token}
                            onChange={(e) => 
                              handleIntegrationChange('whatsapp', 'token', e.target.value)
                            }
                            placeholder="Seu Token"
                          />
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Testar Envio
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="messages" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Mensagens Personalizadas
                </CardTitle>
                <CardDescription>
                  Customize as mensagens automáticas enviadas aos clientes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(messages).map(([type, message]) => (
                  <div key={type} className="space-y-2">
                    <Label htmlFor={type}>
                      {type === 'welcome' && 'Mensagem de Boas-vindas'}
                      {type === 'paymentReminder' && 'Lembrete de Pagamento'}
                      {type === 'paymentConfirmation' && 'Confirmação de Pagamento'}
                      {type === 'suspension' && 'Suspensão de Serviço'}
                      {type === 'reactivation' && 'Reativação de Serviço'}
                    </Label>
                    <Textarea
                      id={type}
                      value={message}
                      onChange={(e) => handleMessageChange(type, e.target.value)}
                      rows={3}
                      placeholder="Digite sua mensagem personalizada..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Variáveis disponíveis: {'{company_name}'}, {'{client_name}'}, {'{amount}'}, {'{days}'}, {'{payment_link}'}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configurações Avançadas
                </CardTitle>
                <CardDescription>
                  Configurações adicionais do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Ocultar Marca VehicleGuard</Label>
                      <p className="text-sm text-muted-foreground">
                        Remove todas as referências à marca VehicleGuard
                      </p>
                    </div>
                    <Switch />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Modo de Manutenção</Label>
                      <p className="text-sm text-muted-foreground">
                        Exibe página de manutenção para clientes
                      </p>
                    </div>
                    <Switch />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>SSL Personalizado</Label>
                      <p className="text-sm text-muted-foreground">
                        Usar certificado SSL próprio
                      </p>
                    </div>
                    <Switch />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Backup Automático</Label>
                      <p className="text-sm text-muted-foreground">
                        Backup diário dos dados da empresa
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

export default WhiteLabelPage