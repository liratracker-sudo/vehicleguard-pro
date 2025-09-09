import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { CreditCard, CheckCircle, AlertCircle, Key, Eye, EyeOff } from "lucide-react"

export function AsaasIntegration() {
  const { toast } = useToast()
  
  const [config, setConfig] = useState({
    apiToken: "",
    isSandbox: true,
    isConfigured: false,
    showToken: false,
    webhookToken: "",
    showWebhookToken: false
  })

  const [companyId, setCompanyId] = useState("")
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [settingWebhook, setSettingWebhook] = useState(false)
  const [lastTestResult, setLastTestResult] = useState<any>(null)
  const [webhookConfigured, setWebhookConfigured] = useState(false)

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile?.company_id) return
      
      setCompanyId(profile.company_id)

      // Verificar se existe configuração do Asaas
      const { data: settings } = await supabase
        .from('asaas_settings')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .maybeSingle()

      if (settings) {
        setConfig({
          apiToken: "••••••••••••••••••••••••••••••••", // Mascarar token existente
          isSandbox: settings.is_sandbox,
          isConfigured: true,
          showToken: false,
          webhookToken: "",
          showWebhookToken: false
        })
        setLastTestResult(settings.test_result)
        setWebhookConfigured(!!settings.webhook_id)
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleSaveSettings = async () => {
    if (!config.apiToken.trim() || config.apiToken.includes('•')) {
      toast({
        title: "Erro",
        description: "Digite uma API key válida do Asaas",
        variant: "destructive"
      })
      return
    }

    if (!companyId) {
      toast({
        title: "Erro", 
        description: "Company ID não encontrado",
        variant: "destructive"
      })
      return
    }

    try {
      setSaving(true)

      // Salvar via Edge Function (criptografia no servidor)
      const response = await supabase.functions.invoke('asaas-integration', {
        body: {
          action: 'save_settings',
          data: {
            api_token: config.apiToken.trim(),
            is_sandbox: config.isSandbox
          }
        }
      })

      if (response.error) {
        throw new Error(response.error.message)
      }

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Falha ao salvar configurações')
      }

      toast({ 
        title: "Sucesso", 
        description: "Configurações do Asaas salvas com sucesso!" 
      })

      setConfig(prev => ({ ...prev, isConfigured: true, apiToken: "••••••••••••••••••••••••••••••••" }))
      await loadSettings()
      
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

  const handleTestConnection = async () => {
    if (!config.isConfigured && !config.apiToken.trim()) {
      toast({
        title: "Erro",
        description: "Salve a API key primeiro antes de testar",
        variant: "destructive"
      })
      return
    }

    try {
      setTesting(true)
      
      // Se token está mascarado, usar configurações salvas, senão testar com token atual
      const testData = config.apiToken.includes('•') 
        ? undefined 
        : { 
            api_token: config.apiToken.trim(),
            is_sandbox: config.isSandbox
          }

      const response = await supabase.functions.invoke('asaas-integration', {
        body: {
          action: 'test_connection',
          data: testData
        }
      })

      if (response.error) {
        throw new Error(response.error.message)
      }

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Falha ao conectar com a API Asaas')
      }

      setLastTestResult({ success: true, account: response.data.account })

      toast({
        title: "Sucesso",
        description: response.data?.message || "Conexão com a API Asaas funcionando corretamente!"
      })
      
    } catch (error: any) {
      setLastTestResult({ success: false, error: error.message })
      toast({
        title: "Erro na conexão",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setTesting(false)
    }
  }

  const toggleTokenVisibility = () => {
    setConfig(prev => ({ ...prev, showToken: !prev.showToken }))
  }

  const toggleWebhookTokenVisibility = () => {
    setConfig(prev => ({ ...prev, showWebhookToken: !prev.showWebhookToken }))
  }

  const handleSetupWebhook = async () => {
    if (!config.isConfigured) {
      toast({
        title: "Erro",
        description: "Salve as configurações do Asaas primeiro",
        variant: "destructive"
      })
      return
    }

    try {
      setSettingWebhook(true)

      const response = await supabase.functions.invoke('asaas-integration', {
        body: {
          action: 'setup_webhook',
          data: {
            webhook_auth_token: config.webhookToken?.trim() || undefined
          }
        }
      })

      if (response.error) {
        throw new Error(response.error.message)
      }

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Falha ao configurar webhook')
      }

      toast({ 
        title: "Sucesso", 
        description: "Webhook configurado com sucesso! O sistema irá receber atualizações automáticas de pagamento." 
      })

      setWebhookConfigured(true)
      await loadSettings()
      
    } catch (error: any) {
      toast({ 
        title: "Erro", 
        description: error.message, 
        variant: "destructive" 
      })
    } finally {
      setSettingWebhook(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Integração Asaas
          </CardTitle>
          <CardDescription>
            Configure sua API key do Asaas para emissão automática de cobranças
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="apiToken">API Key do Asaas *</Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input 
                    id="apiToken"
                    type={config.showToken ? "text" : "password"}
                    value={config.apiToken}
                    onChange={(e) => setConfig({...config, apiToken: e.target.value})}
                    placeholder="Cole sua API key aqui"
                    className="pl-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={toggleTokenVisibility}
                  >
                    {config.showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Você pode encontrar sua API key no painel do Asaas em Configurações → Integrações
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="sandbox"
                checked={config.isSandbox}
                onCheckedChange={(checked) => setConfig({...config, isSandbox: checked})}
              />
              <Label htmlFor="sandbox">Usar ambiente Sandbox (testes)</Label>
            </div>
            
            {config.isSandbox && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Modo Sandbox ativo:</strong> As transações não serão reais. 
                  Desative para usar em produção.
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="webhookToken">Token do Webhook (opcional)</Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input 
                    id="webhookToken"
                    type={config.showWebhookToken ? "text" : "password"}
                    value={config.webhookToken}
                    onChange={(e) => setConfig({ ...config, webhookToken: e.target.value })}
                    placeholder="Defina um token para autenticar os webhooks"
                    className="pl-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={toggleWebhookTokenVisibility}
                  >
                    {config.showWebhookToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Se deixar em branco, geraremos um token automaticamente ao configurar o webhook.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Configuração"}
            </Button>
            <Button 
              onClick={handleTestConnection} 
              disabled={testing} 
              variant="outline"
            >
              {testing ? "Testando..." : "Testar Conexão"}
            </Button>
            {config.isConfigured && (
              <Button 
                onClick={handleSetupWebhook} 
                disabled={settingWebhook || webhookConfigured} 
                variant={webhookConfigured ? "default" : "secondary"}
              >
                {settingWebhook ? "Configurando..." : webhookConfigured ? "Webhook Ativo" : "Configurar Webhook"}
              </Button>
            )}
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm">Status da Integração:</span>
              <Badge variant={config.isConfigured ? "default" : "outline"}>
                {config.isConfigured ? (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Configurado
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Não Configurado
                  </div>
                )}
              </Badge>
            </div>
          </div>

          {lastTestResult && (
            <div className="pt-4 border-t">
              <h4 className="font-medium text-sm mb-2">Último Teste de Conexão:</h4>
              <div className={`p-3 rounded-lg ${lastTestResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                {lastTestResult.success ? (
                  <div>
                    <p className="text-sm text-green-800 font-medium">✓ Conexão bem-sucedida</p>
                    {lastTestResult.account && (
                      <p className="text-xs text-green-700 mt-1">
                        Conta: {lastTestResult.account.name || lastTestResult.account.email}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-red-800">✗ {lastTestResult.error}</p>
                )}
              </div>
            </div>
          )}

          {config.isConfigured && (
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Funcionalidades Disponíveis:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Criação automática de clientes</li>
                <li>• Emissão de cobranças (boleto, PIX, cartão)</li>
                <li>• Acompanhamento de status de pagamento</li>
                <li className={webhookConfigured ? "text-green-600 font-medium" : "text-muted-foreground"}>
                  • {webhookConfigured ? "✓ Webhooks configurados - atualizações automáticas ativas" : "• Webhooks para atualização automática (não configurado)"}
                </li>
                <li>• Relatórios financeiros integrados</li>
              </ul>
              
              {webhookConfigured && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>✓ Webhook Ativo:</strong> O sistema receberá automaticamente as atualizações de status dos pagamentos em tempo real.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}