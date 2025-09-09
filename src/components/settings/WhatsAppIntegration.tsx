import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useWhatsAppConnection } from "@/contexts/WhatsAppContext"
import { MessageCircle, RefreshCw, Phone, AlertCircle, CheckCircle, Settings, QrCode } from "lucide-react"

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
  const [showQRDialog, setShowQRDialog] = useState(false)
  const [qrCodeData, setQrCodeData] = useState<string | null>(null)
  const [loadingQR, setLoadingQR] = useState(false)

  // Sincronizar com context global e mostrar QR quando desconectado
  useEffect(() => {
    setConfig(prev => ({ ...prev, isConnected: connectionState.isConnected }))
    
    // Mostrar QR automaticamente quando desconectar
    if (!connectionState.isConnected && connectionState.connectionStatus === 'disconnected' && config.instanceUrl && config.authToken && config.instanceName) {
      handleShowQR()
    }
  }, [connectionState.isConnected, connectionState.connectionStatus])

  // Monitora mudanças na configuração para mostrar QR
  useEffect(() => {
    if (!connectionState.isConnected && config.instanceUrl && config.authToken && config.instanceName) {
      const timer = setTimeout(() => handleShowQR(), 1000) // Delay para evitar chamadas excessivas
      return () => clearTimeout(timer)
    }
  }, [config.instanceUrl, config.authToken, config.instanceName])

  const handleShowQR = async () => {
    if (!config.instanceUrl || !config.authToken || !config.instanceName) return
    
    try {
      setLoadingQR(true)
      setShowQRDialog(true)
      
      const response = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'get_qr_code',
          instance_url: config.instanceUrl,
          api_token: config.authToken,
          instance_name: config.instanceName
        }
      })

      if (response.error) {
        throw new Error(response.error.message)
      }

      if (response.data?.success && response.data?.qrCode) {
        setQrCodeData(response.data.qrCode)
      } else {
        throw new Error('Falha ao obter QR Code')
      }
    } catch (error: any) {
      toast({
        title: "Erro ao obter QR Code",
        description: error.message,
        variant: "destructive"
      })
      setShowQRDialog(false)
    } finally {
      setLoadingQR(false)
    }
  }

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
            {!connectionState.isConnected && config.instanceUrl && config.authToken && config.instanceName && (
              <Button onClick={handleShowQR} disabled={loadingQR} variant="secondary">
                <QrCode className="w-4 h-4 mr-2" />
                {loadingQR ? "Gerando..." : "QR Code"}
              </Button>
            )}
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

      {/* Dialog do QR Code */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Conectar WhatsApp
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu WhatsApp para conectar a instância
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-4 py-4">
            {loadingQR ? (
              <div className="flex flex-col items-center space-y-2">
                <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            ) : qrCodeData ? (
              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-white rounded-lg border">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeData)}`}
                    alt="QR Code WhatsApp"
                    className="w-48 h-48"
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Abra o WhatsApp no seu celular</p>
                  <p className="text-xs text-muted-foreground">
                    Vá em Menu (⋮) → Dispositivos conectados → Conectar um dispositivo
                  </p>
                </div>
                <Button 
                  onClick={handleShowQR} 
                  variant="outline" 
                  size="sm"
                  disabled={loadingQR}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar QR
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
                <p className="text-sm text-muted-foreground">Erro ao gerar QR Code</p>
                <Button onClick={handleShowQR} variant="outline" size="sm">
                  Tentar novamente
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}