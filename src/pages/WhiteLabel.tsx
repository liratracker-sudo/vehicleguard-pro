import { useState, useEffect, useRef } from "react"
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
  Key,
  X
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

const WhiteLabelPage = () => {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentCompanyId, setCurrentCompanyId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [branding, setBranding] = useState({
    companyName: "",
    logo: "",
    primaryColor: "#3b82f6",
    secondaryColor: "#f8fafc", 
    accentColor: "#10b981",
    domain: "",
    favicon: ""
  })

  const [integrations, setIntegrations] = useState({
    cora: { enabled: false, apiKey: "", environment: "sandbox" },
    asaas: { enabled: false, apiKey: "", environment: "sandbox" },
    mercadoPago: { enabled: false, publicKey: "", accessToken: "", environment: "sandbox" },
    efi: { enabled: false, clientId: "", clientSecret: "", environment: "sandbox" },
    whatsapp: { enabled: false, instanceId: "", token: "" }
  })

  const [savingProvider, setSavingProvider] = useState<string | null>(null)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)

  const [messages, setMessages] = useState({
    welcome: "Bem-vindo ao {company_name}! Seu veículo está protegido conosco.",
    paymentReminder: "Olá {client_name}, sua fatura de R$ {amount} vence em {days} dias. Pague em: {payment_link}",
    paymentConfirmation: "Pagamento confirmado! Obrigado {client_name}. Seu serviço continua ativo.",
    suspension: "Seu serviço foi suspenso por falta de pagamento. Regularize em: {payment_link}",
    reactivation: "Serviço reativado! Seu veículo já está sendo monitorado novamente."
  })

  // Load current user's company and branding data
  useEffect(() => {
    loadCompanyData()
  }, [])

  const loadCompanyData = async () => {
    try {
      // Get current user profile to get company_id
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error("Usuário não encontrado")

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id, full_name')
        .eq('user_id', user.id)
        .single()

      if (profileError) throw profileError
      if (!profile?.company_id) throw new Error("Empresa não encontrada")

      setCurrentCompanyId(profile.company_id)

      // Load company data
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('name, domain')
        .eq('id', profile.company_id)
        .single()

      if (companyError) throw companyError

      // Load branding data
      const { data: brandingData, error: brandingError } = await supabase
        .from('company_branding')
        .select('*')
        .eq('company_id', profile.company_id)
        .maybeSingle()

      if (brandingError && brandingError.code !== 'PGRST116') throw brandingError

      // Update state with loaded data
      setBranding({
        companyName: company?.name || "",
        logo: brandingData?.logo_url || "",
        primaryColor: brandingData?.primary_color || "#3b82f6",
        secondaryColor: brandingData?.secondary_color || "#f8fafc",
        accentColor: "#10b981", // Cor padrão - accent_color não existe no DB
        domain: brandingData?.subdomain || company?.domain || "",
        favicon: brandingData?.favicon_url || ""
      })

    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const saveBrandingData = async () => {
    if (!currentCompanyId) {
      toast({
        title: "Erro",
        description: "ID da empresa não encontrado",
        variant: "destructive"
      })
      return
    }

    try {
      setSaving(true)

      // Save to company_branding table
      const { error } = await supabase
        .from('company_branding')
        .upsert({
          company_id: currentCompanyId,
          logo_url: branding.logo,
          primary_color: branding.primaryColor,
          secondary_color: branding.secondaryColor,
          accent_color: branding.accentColor,
          favicon_url: branding.favicon,
          subdomain: branding.domain
        }, { onConflict: 'company_id' })

      if (error) throw error

      // Update company name if changed
      const { error: companyError } = await supabase
        .from('companies')
        .update({ 
          name: branding.companyName,
          domain: branding.domain 
        })
        .eq('id', currentCompanyId)

      if (companyError) throw companyError

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso!"
      })

    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um arquivo de imagem",
        variant: "destructive"
      })
      return
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "O arquivo deve ter no máximo 2MB",
        variant: "destructive"
      })
      return
    }

    try {
      setUploading(true)

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${currentCompanyId}/logo-${Date.now()}.${fileExt}`

      // Upload to storage
      const { data, error } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName)

      // Update branding state
      setBranding(prev => ({ ...prev, logo: publicUrl }))

      toast({
        title: "Sucesso",
        description: "Logo enviado com sucesso!"
      })

    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeLogo = async () => {
    if (branding.logo) {
      try {
        // Extract filename from URL if it's from our storage
        const urlParts = branding.logo.split('/')
        const fileName = urlParts[urlParts.length - 1]
        
        if (branding.logo.includes('supabase')) {
          await supabase.storage
            .from('company-logos')
            .remove([`${currentCompanyId}/${fileName}`])
        }
      } catch (error) {
        // Ignore storage deletion errors, just remove from state
        console.warn('Error removing logo from storage:', error)
      }
    }
    
    setBranding(prev => ({ ...prev, logo: '' }))
    toast({
      title: "Sucesso",
      description: "Logo removido!"
    })
  }

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

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    )
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
            <Button onClick={saveBrandingData} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
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
                    {branding.logo ? (
                      <div className="space-y-2">
                        <div className="relative inline-block">
                          <img
                            src={branding.logo}
                            alt="Logo da empresa"
                            className="h-20 object-contain border rounded p-2 bg-white"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                            onClick={removeLogo}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Alterar Logo
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                        <div className="text-center">
                          <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                          <div className="mt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploading}
                            >
                              {uploading ? 'Enviando...' : 'Fazer Upload do Logo'}
                            </Button>
                            <p className="text-sm text-muted-foreground mt-2">
                              PNG, JPG até 2MB. Recomendado: 200x60px
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
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
                      {branding.logo ? (
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center overflow-hidden">
                          <img 
                            src={branding.logo} 
                            alt="Logo" 
                            className="w-8 h-8 object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                          <Building2 className="w-6 h-6" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-lg">{branding.companyName || "Sua Empresa"}</h3>
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
                          
                          <div className="flex gap-2">
                            {provider === 'asaas' && (
                              <Button
                                size="sm"
                                onClick={async () => {
                                  if (!('apiKey' in config) || !config.apiKey) {
                                    toast({ title: "Erro", description: "Informe a Chave da API antes de salvar", variant: "destructive" });
                                    return;
                                  }
                                  try {
                                    setSavingProvider('asaas');
                                    const { data, error } = await supabase.functions.invoke('asaas-integration', {
                                      body: {
                                        action: 'save_settings',
                                        data: {
                                          api_token: config.apiKey,
                                          is_sandbox: (config.environment || 'sandbox') !== 'production'
                                        }
                                      }
                                    });
                                    if (error) throw new Error(error.message);
                                    if (!data?.success) throw new Error(data?.message || 'Falha ao salvar configurações');
                                    toast({ title: "Sucesso", description: "Configurações do Asaas salvas!" });
                                  } catch (e:any) {
                                    toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
                                  } finally {
                                    setSavingProvider(null);
                                  }
                                }}
                                disabled={savingProvider==='asaas'}
                              >
                                {savingProvider==='asaas' ? "Salvando..." : "Salvar Configuração"}
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                if (provider !== 'asaas') {
                                  toast({ title: "Indisponível", description: `Teste de conexão ainda não implementado para ${provider}.` });
                                  return;
                                }
                                try {
                                  setTestingProvider(provider);
                                  // Se a chave está preenchida, testar usando ela; senão usar configuração salva
                                  const testData = ('apiKey' in config && config.apiKey)
                                    ? { api_token: config.apiKey, is_sandbox: (config.environment || 'sandbox') !== 'production' }
                                    : undefined;
                                  const { data, error } = await supabase.functions.invoke('asaas-integration', {
                                    body: { action: 'test_connection', data: testData }
                                  });
                                  if (error) throw new Error(error.message);
                                  if (!data?.success) throw new Error(data?.message || 'Falha ao testar conexão');
                                  toast({ title: "Sucesso", description: data?.message || "Conexão testada com sucesso!" });
                                } catch (e:any) {
                                  toast({ title: "Erro ao testar", description: e.message, variant: "destructive" });
                                } finally {
                                  setTestingProvider(null);
                                }
                              }}
                              disabled={testingProvider===provider}
                            >
                              {testingProvider===provider ? "Testando..." : "Testar Conexão"}
                            </Button>
                          </div>
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