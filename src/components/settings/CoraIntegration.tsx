import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { CreditCard, CheckCircle, AlertCircle, Key, Eye, EyeOff, Copy } from "lucide-react"

export function CoraIntegration() {
  const { toast } = useToast()
  
  const [config, setConfig] = useState({
    clientId: "",
    clientSecret: "",
    isSandbox: true,
    isConfigured: false,
    showClientId: false,
    showClientSecret: false
  })

  const [companyId, setCompanyId] = useState("")
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [lastTestResult, setLastTestResult] = useState<any>(null)

  // URL do webhook que deve ser configurada no Cora
  const webhookUrl = "https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/cora-webhook"
  const redirectUrl = "https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/cora-callback"

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

      // TODO: Carregar configurações quando a tabela cora_settings for criada
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleSaveSettings = async () => {
    if (!config.clientId.trim() || config.clientId.includes('•')) {
      toast({
        title: "Erro",
        description: "Digite um Client ID válido do Cora",
        variant: "destructive"
      })
      return
    }

    if (!config.clientSecret.trim() || config.clientSecret.includes('•')) {
      toast({
        title: "Erro",
        description: "Digite um Client Secret válido do Cora",
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
      const response = await supabase.functions.invoke('cora-integration', {
        body: {
          action: 'save_settings',
          data: {
            client_id: config.clientId.trim(),
            client_secret: config.clientSecret.trim(),
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
        description: "Configurações do Cora salvas com sucesso!" 
      })

      setConfig(prev => ({ 
        ...prev, 
        isConfigured: true, 
        clientId: "••••••••••••••••••••••••••••••••",
        clientSecret: "••••••••••••••••••••••••••••••••"
      }))
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
    if (!config.isConfigured && (!config.clientId.trim() || !config.clientSecret.trim())) {
      toast({
        title: "Erro",
        description: "Salve as credenciais primeiro antes de testar",
        variant: "destructive"
      })
      return
    }

    try {
      setTesting(true)
      
      const testData = config.clientId.includes('•') 
        ? undefined 
        : { 
            client_id: config.clientId.trim(),
            client_secret: config.clientSecret.trim(),
            is_sandbox: config.isSandbox
          }

      const response = await supabase.functions.invoke('cora-integration', {
        body: {
          action: 'test_connection',
          data: testData
        }
      })

      if (response.error) {
        throw new Error(response.error.message)
      }

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Falha ao conectar com a API Cora')
      }

      setLastTestResult({ success: true, account: response.data.account })

      toast({
        title: "Sucesso",
        description: response.data?.message || "Conexão com a API Cora funcionando corretamente!"
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência`
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Integração Cora
          </CardTitle>
          <CardDescription>
            Configure sua integração com o Cora Bank para pagamentos e transferências
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="clientId">Client ID *</Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input 
                    id="clientId"
                    type={config.showClientId ? "text" : "password"}
                    value={config.clientId}
                    onChange={(e) => setConfig({...config, clientId: e.target.value})}
                    placeholder="Cole seu Client ID aqui"
                    className="pl-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setConfig(prev => ({ ...prev, showClientId: !prev.showClientId }))}
                  >
                    {config.showClientId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="clientSecret">Client Secret *</Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input 
                    id="clientSecret"
                    type={config.showClientSecret ? "text" : "password"}
                    value={config.clientSecret}
                    onChange={(e) => setConfig({...config, clientSecret: e.target.value})}
                    placeholder="Cole seu Client Secret aqui"
                    className="pl-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setConfig(prev => ({ ...prev, showClientSecret: !prev.showClientSecret }))}
                  >
                    {config.showClientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Acesse o painel do Cora em Conta → Integrações via APIs → Parceria Cora
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="sandbox"
                checked={config.isSandbox}
                onCheckedChange={(checked) => setConfig({...config, isSandbox: checked})}
              />
              <Label htmlFor="sandbox">Usar ambiente de teste (Sandbox)</Label>
            </div>
            
            {config.isSandbox && (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Modo Sandbox ativo:</strong> As transações não serão reais. 
                  Desative para usar em produção.
                </p>
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <h4 className="font-medium text-sm">URLs para configurar no painel do Cora:</h4>
              
              <div>
                <Label className="text-xs text-muted-foreground">1º Link de Redirecionamento:</Label>
                <div className="flex gap-2 mt-1">
                  <Input 
                    value={redirectUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(redirectUrl, "Link de redirecionamento")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">URL do Webhook:</Label>
                <div className="flex gap-2 mt-1">
                  <Input 
                    value={webhookUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(webhookUrl, "URL do webhook")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>📋 Como configurar:</strong> Copie os links acima e cole no painel do Cora em:
                  <br />Conta → Integrações via APIs → Parceria Cora
                </p>
              </div>
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
              <div className={`p-3 rounded-lg ${lastTestResult.success ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800'}`}>
                {lastTestResult.success ? (
                  <div>
                    <p className="text-sm text-green-800 dark:text-green-200 font-medium">✓ Conexão bem-sucedida</p>
                    {lastTestResult.account && (
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        Conta: {lastTestResult.account.name || lastTestResult.account.email}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-red-800 dark:text-red-200">✗ {lastTestResult.error}</p>
                )}
              </div>
            </div>
          )}

          {config.isConfigured && (
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Funcionalidades Disponíveis:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Pagamentos via PIX</li>
                <li>• Transferências bancárias</li>
                <li>• Consulta de saldo e extrato</li>
                <li>• Webhooks para atualizações automáticas</li>
                <li>• Emissão de boletos</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}