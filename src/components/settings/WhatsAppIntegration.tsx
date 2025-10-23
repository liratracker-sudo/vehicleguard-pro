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
    instanceName: "",
    enableLogs: true,
    enableDeliveryStatus: true,
    isConnected: connectionState.isConnected
  })

  const [companyId, setCompanyId] = useState("")
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [showQRDialog, setShowQRDialog] = useState(false)
  const [qrCodeData, setQrCodeData] = useState<string | null>(null)
  const [loadingQR, setLoadingQR] = useState(false)
  const [clearingInstance, setClearingInstance] = useState(false)

  // Sincronizar com context global e com banco
  useEffect(() => {
    setConfig(prev => ({ ...prev, isConnected: connectionState.isConnected }))
    
    // Se conectou, recarregar configurações do banco
    if (connectionState.isConnected && !config.isConnected) {
      console.log('WhatsApp conectado! Recarregando configurações...')
      loadSettings()
    }
  }, [connectionState.isConnected])

  // Listener em tempo real para mudanças nas configurações
  useEffect(() => {
    if (!companyId) return

    const channel = supabase
      .channel('whatsapp-settings-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_settings',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          console.log('Configurações do WhatsApp mudaram:', payload)
          const newData = payload.new as any
          
          setConfig({
            instanceName: newData.instance_name || '',
            enableLogs: newData.enable_logs,
            enableDeliveryStatus: newData.enable_delivery_status,
            isConnected: newData.connection_status === 'connected'
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [companyId])

  // Remover o useEffect que chamava QR automaticamente
  // pois estava causando loops infinitos

  const handleShowQR = async (forceNew = false) => {
    if (!config.instanceName) {
      toast({
        title: "Configuração incompleta",
        description: "Preencha o nome da instância antes de continuar",
        variant: "destructive"
      })
      return
    }
    
    try {
      setLoadingQR(true)
      setShowQRDialog(true)
      setQrCodeData(null) // Limpar QR Code anterior
      
      const response = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'get_qr_code',
          instance_name: config.instanceName,
          force_new: forceNew,
          company_id: companyId
        }
      })

      console.log('QR Code response:', response)

      if (response.error) {
        throw new Error(response.error.message)
      }

      if (response.data?.success && response.data?.qrCode) {
        setQrCodeData(response.data.qrCode)
      } else {
        const errorMsg = response.data?.error || 'Falha ao obter QR Code'
        const hint = response.data?.hint || ''
        throw new Error(`${errorMsg}${hint ? ` - ${hint}` : ''}`)
      }
    } catch (error: any) {
      console.error('Erro completo:', error)
      toast({
        title: "Erro ao obter QR Code",
        description: error.message || "Verifique suas credenciais e tente novamente",
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
    if (!config.instanceName.trim() || !companyId) {
      toast({
        title: "Erro",
        description: "Preencha o nome da instância",
        variant: "destructive"
      })
      return
    }

    try {
      setSaving(true)
      
      // Obter URL e Token dos secrets da edge function
      const { data: secretsData, error: secretsError } = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'get_secrets',
          company_id: companyId
        }
      })

      if (secretsError || !secretsData?.instance_url || !secretsData?.api_token) {
        throw new Error('Credenciais do WhatsApp não configuradas nos secrets do sistema')
      }

      // Primeiro, limpar todas as sessões antigas desta empresa
      await supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('company_id', companyId)

      // Salvar novas configurações com URL e Token reais dos secrets
      await supabase.from('whatsapp_settings').upsert({
        company_id: companyId,
        instance_name: config.instanceName,
        instance_url: secretsData.instance_url,
        api_token: secretsData.api_token,
        is_active: true,
        enable_logs: config.enableLogs,
        enable_delivery_status: config.enableDeliveryStatus,
        connection_status: 'disconnected'
      }, { onConflict: 'company_id' })

      toast({ 
        title: "Sucesso", 
        description: "Configurações salvas! As credenciais da API estão configuradas no sistema." 
      })
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

  const handleClearInstance = async () => {
    if (!config.instanceName) {
      toast({
        title: "Configuração incompleta",
        description: "Preencha o nome da instância antes de limpar",
        variant: "destructive"
      })
      return
    }

    try {
      setClearingInstance(true)
      
      const response = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'clear_instance',
          instance_name: config.instanceName,
          company_id: companyId
        }
      })

      console.log('Clear instance response:', response)

      if (response.error) {
        throw new Error(response.error.message)
      }

      if (response.data?.success) {
        toast({
          title: "Instância limpa",
          description: "Dados antigos removidos. Agora você pode configurar uma nova instância.",
          variant: "default"
        })
        
        // Recarregar configurações e status
        await loadSettings()
        refreshConnection()
      } else {
        const errorMsg = response.data?.error || 'Falha ao limpar instância'
        throw new Error(errorMsg)
      }
    } catch (error: any) {
      console.error('Erro ao limpar instância:', error)
      toast({
        title: "Erro ao limpar instância",
        description: error.message || "Verifique suas credenciais e tente novamente",
        variant: "destructive"
      })
    } finally {
      setClearingInstance(false)
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
          <div className="space-y-2">
            <Label>Nome da Instância *</Label>
            <Input 
              value={config.instanceName}
              onChange={(e) => setConfig({...config, instanceName: e.target.value})}
              placeholder="minha-instancia"
            />
            <p className="text-sm text-muted-foreground">
              As credenciais da API (URL e Token) estão configuradas no sistema.
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button onClick={handleConnect} disabled={connecting} variant="outline">
              {connecting ? "Conectando..." : "Conectar"}
            </Button>
            {config.instanceName && (
              <>
                <Button onClick={handleClearInstance} disabled={clearingInstance} variant="destructive" size="sm">
                  {clearingInstance ? "Limpando..." : "Limpar Instância"}
                </Button>
                {!connectionState.isConnected && (
                  <Button onClick={() => handleShowQR(false)} disabled={loadingQR} variant="secondary">
                    <QrCode className="w-4 h-4 mr-2" />
                    {loadingQR ? "Gerando..." : "QR Code"}
                  </Button>
                )}
              </>
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
                    src={qrCodeData}
                    alt="QR Code WhatsApp"
                    className="w-48 h-48"
                    onError={(e) => {
                      console.error('Erro ao carregar QR Code:', qrCodeData);
                      e.currentTarget.src = '/placeholder.svg';
                    }}
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Abra o WhatsApp no seu celular</p>
                  <p className="text-xs text-muted-foreground">
                    Vá em Menu (⋮) → Dispositivos conectados → Conectar um dispositivo
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleShowQR(false)} 
                    variant="outline" 
                    size="sm"
                    disabled={loadingQR}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atualizar QR
                  </Button>
                  <Button 
                    onClick={() => handleShowQR(true)} 
                    variant="destructive" 
                    size="sm"
                    disabled={loadingQR}
                  >
                    Nova Instância
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
                <p className="text-sm text-muted-foreground">Erro ao gerar QR Code</p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => handleShowQR(false)} variant="outline" size="sm">
                    Tentar novamente
                  </Button>
                  <Button onClick={() => handleShowQR(true)} variant="destructive" size="sm">
                    Nova Instância
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}