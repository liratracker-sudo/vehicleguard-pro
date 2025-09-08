import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useWhatsAppConnection } from "@/contexts/WhatsAppContext"
import { MessageCircle, RefreshCw, Phone, AlertCircle, CheckCircle, Settings } from "lucide-react"

export function WhatsAppIntegration() {
  const { toast } = useToast()
  const { connectionState, checkConnection, reconnect, refreshConnection } = useWhatsAppConnection()
  
  const [config, setConfig] = useState({
    instanceUrl: "",
    authToken: "",
    instanceName: "",
    enableLogs: true,
    enableDeliveryStatus: true,
    isConnected: connectionState.isConnected
  })

  const [companyId, setCompanyId] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)

  // Sincronizar com context global
  useEffect(() => {
    setConfig(prev => ({ ...prev, isConnected: connectionState.isConnected }))
  }, [connectionState.isConnected])

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
        .from('whatsapp_settings')
        .select('*')
        .eq('company_id', profile.company_id)
        .maybeSingle()

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

  useEffect(() => {
    loadSettings()
  }, [])

  const handleSaveSettings = async () => {
    if (!config.instanceName.trim() || !config.authToken.trim() || !companyId) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      })
      return
    }

    try {
      setSaving(true)
      await supabase.from('whatsapp_settings').upsert({
        company_id: companyId,
        instance_name: config.instanceName,
        instance_url: config.instanceUrl,
        api_token: config.authToken,
        is_active: true,
        enable_logs: config.enableLogs,
        enable_delivery_status: config.enableDeliveryStatus,
        connection_status: 'disconnected'
      }, { onConflict: 'company_id' })

      toast({ title: "Sucesso", description: "Configurações salvas!" })
      refreshConnection()
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const success = await reconnect()
      if (success) await loadSettings()
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Credenciais WhatsApp Evolution</CardTitle>
          <CardDescription>Configure para manter conexão persistente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>URL da Instância *</Label>
              <Input 
                value={config.instanceUrl}
                onChange={(e) => setConfig({...config, instanceUrl: e.target.value})}
                placeholder="https://api.evolution.com.br"
              />
            </div>
            <div>
              <Label>Nome da Instância *</Label>
              <Input 
                value={config.instanceName}
                onChange={(e) => setConfig({...config, instanceName: e.target.value})}
                placeholder="minha-instancia"
              />
            </div>
          </div>
          
          <div>
            <Label>Token de Autenticação *</Label>
            <Input 
              type="password"
              value={config.authToken}
              onChange={(e) => setConfig({...config, authToken: e.target.value})}
              placeholder="seu-token-secreto"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button onClick={handleConnect} disabled={connecting} variant="outline">
              {connecting ? "Conectando..." : "Conectar"}
            </Button>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm">Status: {connectionState.connectionStatus}</span>
              <Badge variant={connectionState.isConnected ? "default" : "outline"}>
                {connectionState.isConnected ? "Conectado" : "Desconectado"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}