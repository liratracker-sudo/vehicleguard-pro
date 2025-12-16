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
import { MessageCircle, RefreshCw, Phone, AlertCircle, CheckCircle, Settings, QrCode, RotateCcw, Loader2, CircleDot, Check, X } from "lucide-react"

type ReconnectStep = {
  id: string
  label: string
  status: 'pending' | 'running' | 'success' | 'error'
  error?: string
}

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
  
  // Estado para reconexão limpa
  const [showCleanReconnectDialog, setShowCleanReconnectDialog] = useState(false)
  const [cleanReconnectSteps, setCleanReconnectSteps] = useState<ReconnectStep[]>([])
  const [cleanReconnectRunning, setCleanReconnectRunning] = useState(false)
  const [cleanReconnectQR, setCleanReconnectQR] = useState<string | null>(null)

  // Sincronizar com context global e com banco
  useEffect(() => {
    setConfig(prev => ({ ...prev, isConnected: connectionState.isConnected }))
    
    // Se conectou, recarregar configurações do banco
    if (connectionState.isConnected && !config.isConnected) {
      console.log('WhatsApp conectado! Recarregando configurações...')
      loadSettings()
    }
  }, [connectionState.isConnected])

  // Fechar dialog do QR Code automaticamente quando conectar
  useEffect(() => {
    if (connectionState.isConnected && showQRDialog) {
      console.log('WhatsApp conectado! Fechando dialog do QR Code...')
      setShowQRDialog(false)
      setQrCodeData(null)
      toast({
        title: "WhatsApp Conectado!",
        description: "O WhatsApp foi conectado com sucesso.",
      })
    }
  }, [connectionState.isConnected, showQRDialog, toast])

  // Polling para verificar conexão enquanto dialog está aberto
  useEffect(() => {
    if (!showQRDialog || connectionState.isConnected || !qrCodeData) return

    console.log('Iniciando polling de verificação de conexão...')
    
    const checkInterval = setInterval(async () => {
      console.log('Verificando se conectou...')
      await checkConnection()
    }, 3000) // Verificar a cada 3 segundos

    return () => {
      console.log('Parando polling de verificação de conexão')
      clearInterval(checkInterval)
    }
  }, [showQRDialog, connectionState.isConnected, qrCodeData, checkConnection])

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

    if (!companyId) {
      toast({
        title: "Erro",
        description: "Empresa não identificada. Faça login novamente.",
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

      // Buscar configurações existentes para pegar o ID
      const { data: existingSettings } = await supabase
        .from('whatsapp_settings')
        .select('id')
        .eq('company_id', companyId)
        .maybeSingle()

      // Primeiro, limpar todas as sessões antigas desta empresa
      await supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('company_id', companyId)

      // Salvar novas configurações com URL e Token reais dos secrets
      const settingsToSave = {
        company_id: companyId,
        instance_name: config.instanceName,
        instance_url: secretsData.instance_url,
        api_token: secretsData.api_token,
        is_active: true,
        enable_logs: config.enableLogs,
        enable_delivery_status: config.enableDeliveryStatus,
        connection_status: 'disconnected'
      }

      // Se já existe, incluir o ID para atualizar; senão, criar novo
      if (existingSettings?.id) {
        await supabase
          .from('whatsapp_settings')
          .update(settingsToSave)
          .eq('id', existingSettings.id)
      } else {
        await supabase
          .from('whatsapp_settings')
          .insert(settingsToSave)
      }

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

  // Função de Reconexão Limpa
  const handleCleanReconnect = async () => {
    if (!config.instanceName) {
      toast({
        title: "Configuração incompleta",
        description: "Preencha o nome da instância antes de reconectar",
        variant: "destructive"
      })
      return
    }

    const initialSteps: ReconnectStep[] = [
      { id: 'clear', label: 'Limpando instância antiga', status: 'pending' },
      { id: 'wait', label: 'Aguardando sincronização', status: 'pending' },
      { id: 'create', label: 'Criando nova instância', status: 'pending' },
      { id: 'qr', label: 'Gerando QR Code', status: 'pending' },
    ]

    setCleanReconnectSteps(initialSteps)
    setCleanReconnectQR(null)
    setShowCleanReconnectDialog(true)
    setCleanReconnectRunning(true)

    const updateStep = (stepId: string, status: ReconnectStep['status'], error?: string) => {
      setCleanReconnectSteps(prev => prev.map(s => 
        s.id === stepId ? { ...s, status, error } : s
      ))
    }

    try {
      // Step 1: Limpar instância antiga
      updateStep('clear', 'running')
      const clearResponse = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'clear_instance',
          instance_name: config.instanceName,
          company_id: companyId
        }
      })

      if (clearResponse.error) {
        throw new Error(`Erro ao limpar: ${clearResponse.error.message}`)
      }
      updateStep('clear', 'success')

      // Step 2: Aguardar sincronização
      updateStep('wait', 'running')
      await new Promise(resolve => setTimeout(resolve, 2000))
      updateStep('wait', 'success')

      // Step 3 & 4: Criar nova instância e gerar QR Code
      updateStep('create', 'running')
      const qrResponse = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'get_qr_code',
          instance_name: config.instanceName,
          force_new: true,
          company_id: companyId
        }
      })

      if (qrResponse.error) {
        throw new Error(`Erro ao criar instância: ${qrResponse.error.message}`)
      }

      updateStep('create', 'success')
      updateStep('qr', 'running')

      if (qrResponse.data?.success && qrResponse.data?.qrCode) {
        setCleanReconnectQR(qrResponse.data.qrCode)
        updateStep('qr', 'success')
        
        toast({
          title: "Reconexão iniciada!",
          description: "Escaneie o QR Code com o WhatsApp para completar.",
        })
      } else {
        throw new Error(qrResponse.data?.error || 'Falha ao gerar QR Code')
      }

    } catch (error: any) {
      console.error('Erro na reconexão limpa:', error)
      
      // Marcar etapa atual como erro
      setCleanReconnectSteps(prev => {
        const runningStep = prev.find(s => s.status === 'running')
        if (runningStep) {
          return prev.map(s => s.id === runningStep.id 
            ? { ...s, status: 'error', error: error.message } 
            : s
          )
        }
        return prev
      })

      toast({
        title: "Erro na reconexão",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setCleanReconnectRunning(false)
    }
  }

  // Polling para verificar conexão durante reconexão limpa
  useEffect(() => {
    if (!showCleanReconnectDialog || connectionState.isConnected || !cleanReconnectQR) return

    console.log('Iniciando polling durante reconexão limpa...')
    
    const checkInterval = setInterval(async () => {
      await checkConnection()
    }, 3000)

    return () => clearInterval(checkInterval)
  }, [showCleanReconnectDialog, connectionState.isConnected, cleanReconnectQR, checkConnection])

  // Fechar dialog de reconexão limpa quando conectar
  useEffect(() => {
    if (connectionState.isConnected && showCleanReconnectDialog && cleanReconnectQR) {
      console.log('WhatsApp conectado durante reconexão limpa!')
      setShowCleanReconnectDialog(false)
      setCleanReconnectQR(null)
      refreshConnection()
      toast({
        title: "WhatsApp Reconectado!",
        description: "A reconexão foi concluída com sucesso.",
      })
    }
  }, [connectionState.isConnected, showCleanReconnectDialog, cleanReconnectQR, refreshConnection, toast])

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
                <Button 
                  onClick={handleCleanReconnect} 
                  disabled={cleanReconnectRunning} 
                  variant="outline" 
                  size="sm"
                  className="border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {cleanReconnectRunning ? "Reconectando..." : "Reconectar Limpo"}
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
                {/* Indicador de aguardando conexão */}
                <div className="flex items-center gap-2 text-amber-600">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">Aguardando leitura do QR Code...</span>
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

      {/* Dialog de Reconexão Limpa */}
      <Dialog open={showCleanReconnectDialog} onOpenChange={(open) => {
        if (!cleanReconnectRunning) setShowCleanReconnectDialog(open)
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              Reconexão Limpa do WhatsApp
            </DialogTitle>
            <DialogDescription>
              Este processo limpa a sessão antiga e cria uma nova conexão do zero
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Progress Steps */}
            <div className="space-y-3">
              {cleanReconnectSteps.map((step) => (
                <div 
                  key={step.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    step.status === 'running' ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' :
                    step.status === 'success' ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' :
                    step.status === 'error' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' :
                    'bg-muted/50 border-border'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {step.status === 'pending' && (
                      <CircleDot className="w-5 h-5 text-muted-foreground" />
                    )}
                    {step.status === 'running' && (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    )}
                    {step.status === 'success' && (
                      <Check className="w-5 h-5 text-green-600" />
                    )}
                    {step.status === 'error' && (
                      <X className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${
                      step.status === 'running' ? 'text-blue-700 dark:text-blue-300' :
                      step.status === 'success' ? 'text-green-700 dark:text-green-300' :
                      step.status === 'error' ? 'text-red-700 dark:text-red-300' :
                      'text-muted-foreground'
                    }`}>
                      {step.label}
                    </p>
                    {step.error && (
                      <p className="text-xs text-red-600 mt-1">{step.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* QR Code após etapas concluídas */}
            {cleanReconnectQR && (
              <div className="flex flex-col items-center space-y-4 pt-4 border-t">
                <div className="p-4 bg-white rounded-lg border shadow-sm">
                  <img 
                    src={cleanReconnectQR}
                    alt="QR Code WhatsApp"
                    className="w-48 h-48"
                    onError={(e) => {
                      console.error('Erro ao carregar QR Code:', cleanReconnectQR);
                      e.currentTarget.src = '/placeholder.svg';
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 text-amber-600">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">Aguardando leitura do QR Code...</span>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Escaneie com o WhatsApp</p>
                  <p className="text-xs text-muted-foreground">
                    Menu (⋮) → Dispositivos conectados → Conectar um dispositivo
                  </p>
                </div>
              </div>
            )}

            {/* Botão de fechar se houver erro */}
            {cleanReconnectSteps.some(s => s.status === 'error') && (
              <div className="flex justify-center pt-2">
                <Button 
                  onClick={() => setShowCleanReconnectDialog(false)}
                  variant="outline"
                >
                  Fechar
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}