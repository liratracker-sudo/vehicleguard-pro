import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { FileText, CheckCircle, AlertCircle, Key } from "lucide-react"

export function AutentiqueIntegration() {
  const { toast } = useToast()
  
  const [config, setConfig] = useState({
    apiToken: "",
    isConfigured: false
  })

  const [companyId, setCompanyId] = useState("")
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

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

      // Verificar se existe configuração no sistema
      const { data: settings } = await supabase
        .from('companies')
        .select('settings')
        .eq('id', profile.company_id)
        .maybeSingle()

      const settingsData = settings?.settings as any
      if (settingsData?.autentique_api_token) {
        setConfig({
          apiToken: "••••••••••••••••", // Mascarar token existente
          isConfigured: true
        })
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleSaveSettings = async () => {
    if (!config.apiToken.trim() || config.apiToken === "••••••••••••••••") {
      toast({
        title: "Erro",
        description: "Digite um token de API válido",
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

      // Buscar configurações atuais
      const { data: currentSettings } = await supabase
        .from('companies')
        .select('settings')
        .eq('id', companyId)
        .maybeSingle()

      const currentSettingsData = (currentSettings?.settings as any) || {}
      const updatedSettings = {
        ...currentSettingsData,
        autentique_api_token: config.apiToken
      }

      await supabase
        .from('companies')
        .update({ 
          settings: updatedSettings
        })
        .eq('id', companyId)

      toast({ 
        title: "Sucesso", 
        description: "Token da API Autentique salvo com sucesso!" 
      })
      
      setConfig(prev => ({ ...prev, isConfigured: true }))
      
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
    if (!config.isConfigured) {
      toast({
        title: "Erro",
        description: "Salve o token primeiro antes de testar",
        variant: "destructive"
      })
      return
    }

    try {
      setTesting(true)
      
      // Testar conexão com Autentique fazendo uma chamada básica
      const response = await supabase.functions.invoke('autentique-integration', {
        body: {
          action: 'test_connection'
        }
      })

      if (response.error) {
        throw new Error(response.error.message)
      }

      toast({
        title: "Sucesso",
        description: "Conexão com a API Autentique funcionando corretamente!"
      })
      
    } catch (error: any) {
      toast({
        title: "Erro na conexão",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Integração Autentique
          </CardTitle>
          <CardDescription>
            Configure sua API token do Autentique para geração de documentos digitais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="apiToken">Token da API Autentique *</Label>
            <div className="flex gap-2 mt-1">
              <div className="relative flex-1">
                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input 
                  id="apiToken"
                  type="password"
                  value={config.apiToken}
                  onChange={(e) => setConfig({...config, apiToken: e.target.value})}
                  placeholder="Cole seu token da API aqui"
                  className="pl-10"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Você pode encontrar seu token na seção API do seu painel Autentique
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Token"}
            </Button>
            <Button 
              onClick={handleTestConnection} 
              disabled={testing || !config.isConfigured} 
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

          {config.isConfigured && (
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Funcionalidades Disponíveis:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Geração automática de contratos digitais</li>
                <li>• Envio para assinatura eletrônica</li>
                <li>• Acompanhamento do status de assinatura</li>
                <li>• Armazenamento seguro de documentos</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}