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

export function GerencianetIntegration() {
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

      const { data: settings } = await supabase
        .from('gerencianet_settings')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .maybeSingle()

      if (settings) {
        setConfig({
          clientId: "••••••••••••••••••••••••••••••••",
          clientSecret: "••••••••••••••••••••••••••••••••",
          isSandbox: settings.is_sandbox,
          isConfigured: true,
          showClientId: false,
          showClientSecret: false
        })
        setLastTestResult(settings.test_result)
      }
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
        description: "Digite um Client ID válido",
        variant: "destructive"
      })
      return
    }

    if (!config.clientSecret.trim() || config.clientSecret.includes('•')) {
      toast({
        title: "Erro",
        description: "Digite um Client Secret válido",
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

      const response = await supabase.functions.invoke('gerencianet-integration', {
        body: {
          action: 'save_settings',
          company_id: companyId,
          client_id: config.clientId.trim(),
          client_secret: config.clientSecret.trim(),
          is_sandbox: config.isSandbox
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
        description: "Configurações da Gerencianet salvas com sucesso!" 
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
      
      const testData = (config.clientId.includes('•') || config.clientSecret.includes('•'))
        ? { company_id: companyId }
        : { 
            company_id: companyId,
            client_id: config.clientId.trim(),
            client_secret: config.clientSecret.trim(),
            is_sandbox: config.isSandbox
          }

      const response = await supabase.functions.invoke('gerencianet-integration', {
        body: {
          action: 'test_credentials',
          ...testData
        }
      })

      if (response.error) {
        throw new Error(response.error.message)
      }

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Falha ao conectar com a API Gerencianet')
      }

      setLastTestResult({ success: true })

      toast({
        title: "Sucesso",
        description: "Conexão com a API Gerencianet funcionando corretamente!"
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

  const toggleClientIdVisibility = () => {
    setConfig(prev => ({ ...prev, showClientId: !prev.showClientId }))
  }

  const toggleClientSecretVisibility = () => {
    setConfig(prev => ({ ...prev, showClientSecret: !prev.showClientSecret }))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Integração Gerencianet / Efí Pay
          </CardTitle>
          <CardDescription>
            Configure suas credenciais da Gerencianet para emissão de boletos bancários
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
                    onClick={toggleClientIdVisibility}
                  >
                    {config.showClientId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Você pode encontrar suas credenciais no painel da Gerencianet em Aplicações → Suas Aplicações
              </p>
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
                    onClick={toggleClientSecretVisibility}
                  >
                    {config.showClientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="sandbox"
                checked={config.isSandbox}
                onCheckedChange={(checked) => setConfig({...config, isSandbox: checked})}
              />
              <Label htmlFor="sandbox">Usar ambiente Homologação (testes)</Label>
            </div>
            
            {config.isSandbox && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Modo Homologação ativo:</strong> Os boletos gerados não serão reais. 
                  Desative para usar em produção.
                </p>
              </div>
            )}
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
              <div className={`p-3 rounded-lg ${lastTestResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                {lastTestResult.success ? (
                  <p className="text-sm text-green-800 font-medium">✓ Conexão bem-sucedida</p>
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
                <li>• Emissão de boletos bancários</li>
                <li>• Boletos com QR Code PIX integrado</li>
                <li>• Configuração de multa e juros</li>
                <li>• Consulta de status de boletos</li>
                <li>• Cancelamento de boletos</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
