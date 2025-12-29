import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTimeBR } from "@/lib/timezone"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Loader2, ExternalLink, CheckCircle2, XCircle } from "lucide-react"

export function MercadoPagoIntegration() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [accessToken, setAccessToken] = useState("")
  const [isSandbox, setIsSandbox] = useState(true)
  const [webhookEnabled, setWebhookEnabled] = useState(false)
  const [settings, setSettings] = useState<any>(null)

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile?.company_id) return

      const { data } = await supabase
        .from('mercadopago_settings')
        .select('*')
        .eq('company_id', profile.company_id)
        .single()

      if (data) {
        setSettings(data)
        setIsSandbox(data.is_sandbox)
        setWebhookEnabled(data.webhook_enabled || false)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleTestConnection = async () => {
    const cleanToken = accessToken.trim()
    
    if (!cleanToken) {
      toast({
        title: "Erro",
        description: "Informe o Access Token",
        variant: "destructive"
      })
      return
    }

    // Validação do formato do token
    if (isSandbox && !cleanToken.startsWith('TEST-')) {
      toast({
        title: "Atenção",
        description: "Você está no modo Sandbox mas o token não começa com 'TEST-'. Verifique se está usando o token de teste correto.",
        variant: "destructive"
      })
      return
    }

    if (!isSandbox && !cleanToken.startsWith('APP_USR-')) {
      toast({
        title: "Atenção",
        description: "Você está no modo Produção mas o token não começa com 'APP_USR-'. Verifique se está usando o token correto.",
        variant: "destructive"
      })
      return
    }

    setTestingConnection(true)
    try {
      const { data, error } = await supabase.functions.invoke('mercadopago-integration', {
        body: {
          action: 'test_connection',
          access_token: cleanToken,
          is_sandbox: isSandbox
        }
      })

      if (error) throw error

      // Mostrar warning se houver
      if (data.warning) {
        toast({
          title: "Conexão testada com aviso",
          description: data.warning,
        })
      }

      toast({
        title: "Conexão testada com sucesso!",
        description: `Conta: ${data.data.email}`,
      })
    } catch (error: any) {
      // Melhorar mensagens de erro comuns
      let errorMessage = error.message
      if (errorMessage.includes('Si quieres conocer') || errorMessage.includes('recursos de la API')) {
        errorMessage = 'Token inválido. Verifique se copiou corretamente e se corresponde ao ambiente selecionado.'
      }
      
      toast({
        title: "Erro ao testar conexão",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setTestingConnection(false)
    }
  }

  const handleSave = async () => {
    if (!accessToken) {
      toast({
        title: "Erro",
        description: "Informe o Access Token",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.functions.invoke('mercadopago-integration', {
        body: {
          action: 'save_settings',
          access_token: accessToken,
          is_sandbox: isSandbox,
          webhook_enabled: webhookEnabled
        }
      })

      if (error) throw error

      toast({
        title: "Configurações salvas!",
        description: "As configurações do Mercado Pago foram salvas com sucesso.",
      })

      await loadSettings()
      setAccessToken("")
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const webhookUrl = `https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/mercadopago-webhook`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Mercado Pago
          {settings?.is_active && (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
        </CardTitle>
        <CardDescription>
          Configure a integração com o Mercado Pago para processar pagamentos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="accessToken">Access Token</Label>
          <Input
            id="accessToken"
            type="password"
            placeholder={isSandbox ? "TEST-..." : "APP_USR-..."}
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {isSandbox 
              ? "Token de teste deve começar com TEST-..." 
              : "Token de produção deve começar com APP_USR-..."}
          </p>
          <p className="text-xs text-muted-foreground">
            Obtenha seu Access Token em{" "}
            <a
              href="https://www.mercadopago.com.br/developers/panel/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Suas credenciais
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="sandbox">Modo Sandbox (Testes)</Label>
            <p className="text-xs text-muted-foreground">
              Ative para usar o ambiente de testes
            </p>
          </div>
          <Switch
            id="sandbox"
            checked={isSandbox}
            onCheckedChange={setIsSandbox}
          />
        </div>

        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="webhook">Webhook Automático</Label>
            <p className="text-xs text-muted-foreground">
              Receber notificações automáticas de pagamentos
            </p>
          </div>
          <Switch
            id="webhook"
            checked={webhookEnabled}
            onCheckedChange={setWebhookEnabled}
          />
        </div>

        {webhookEnabled && (
          <div className="space-y-2 rounded-lg border p-4 bg-muted/50">
            <Label>URL do Webhook</Label>
            <div className="flex items-center gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl)
                  toast({
                    title: "URL copiada!",
                    description: "A URL do webhook foi copiada para a área de transferência.",
                  })
                }}
              >
                Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure esta URL em{" "}
              <a
                href="https://www.mercadopago.com.br/developers/panel/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Webhooks do Mercado Pago
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleTestConnection}
            disabled={testingConnection || loading}
            variant="outline"
          >
            {testingConnection && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Testar Conexão
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || testingConnection}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Configurações
          </Button>
        </div>

        {settings?.last_test_at && (
          <div className="text-xs text-muted-foreground">
            Último teste: {formatDateTimeBR(settings.last_test_at)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}