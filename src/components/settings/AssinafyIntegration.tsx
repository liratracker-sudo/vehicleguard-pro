import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Loader2, TestTube, CheckCircle, XCircle, Copy, Webhook, AlertTriangle } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface PendingContract {
  id: string
  assinafy_document_id: string
  client_name: string
  created_at: string
}

export function AssinafyIntegration() {
  const [apiKey, setApiKey] = useState("")
  const [workspaceId, setWorkspaceId] = useState("")
  const [isConfigured, setIsConfigured] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [pendingContracts, setPendingContracts] = useState<PendingContract[]>([])
  const [selectedContract, setSelectedContract] = useState<string>("")
  const [testingWebhook, setTestingWebhook] = useState(false)
  const { toast } = useToast()

  const WEBHOOK_URL = "https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/assinafy-webhook"

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    if (companyId && isConfigured) {
      loadPendingContracts()
    }
  }, [companyId, isConfigured])

  const loadSettings = async () => {
    try {
      setLoading(true)
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get user profile to find company
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()
      
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      // Load Assinafy settings from new table
      const { data: settings, error: settingsError } = await supabase
        .from('assinafy_settings')
        .select('workspace_id, is_active')
        .eq('company_id', profile.company_id)
        .maybeSingle()
      
      if (settingsError) {
        console.error('Error loading Assinafy settings:', settingsError)
      }

      if (settings) {
        setWorkspaceId(settings.workspace_id || "")
        setIsConfigured(settings.is_active || false)
        // API key is encrypted, so we don't load it for display
        setApiKey("")
      } else {
        setWorkspaceId("")
        setIsConfigured(false)
        setApiKey("")
      }
    } catch (error: any) {
      console.error('Error loading Assinafy settings:', error)
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações do Assinafy",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!companyId || !apiKey.trim() || !workspaceId.trim()) {
      toast({
        title: "Erro",
        description: "Preencha a chave da API e o ID do workspace",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)

      // Salvar configurações via Edge Function
      const { data, error } = await supabase.functions.invoke('assinafy-integration', {
        body: { 
          action: 'saveSettings',
          company_id: companyId,
          apiKey: apiKey.trim(),
          workspaceId: workspaceId.trim()
        }
      })

      if (error) throw error

      if (!data.success) {
        throw new Error(data.error || 'Falha ao salvar configurações')
      }

      setIsConfigured(true)
      toast({
        title: "Sucesso",
        description: "Configurações do Assinafy salvas com sucesso!",
      })
    } catch (error: any) {
      console.error('Error saving Assinafy settings:', error)
      toast({
        title: "Erro", 
        description: "Erro ao salvar configurações do Assinafy",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    if (!apiKey.trim() || !workspaceId.trim()) {
      toast({
        title: "Erro",
        description: "Configure a chave da API e workspace antes de testar",
        variant: "destructive",
      })
      return
    }

    try {
      setTesting(true)

      const { data, error } = await supabase.functions.invoke('assinafy-integration', {
        body: { 
          action: 'testConnection',
          apiKey: apiKey.trim(),
          workspaceId: workspaceId.trim()
        }
      })

      if (error) throw error

      if (data.success) {
        toast({
          title: "Sucesso",
          description: "Conexão com Assinafy estabelecida com sucesso!",
        })
      } else {
        throw new Error(data.error || 'Falha na conexão')
      }
    } catch (error: any) {
      console.error('Error testing Assinafy connection:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao testar conexão com Assinafy",
        variant: "destructive",
      })
    } finally {
      setTesting(false)
    }
  }

  const loadPendingContracts = async () => {
    if (!companyId) return

    try {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          id,
          assinafy_document_id,
          created_at,
          clients!inner(name)
        `)
        .eq('company_id', companyId)
        .not('assinafy_document_id', 'is', null)
        .in('signature_status', ['pending', 'waiting_signature'])
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      const contracts: PendingContract[] = (data || []).map((c: any) => ({
        id: c.id,
        assinafy_document_id: c.assinafy_document_id,
        client_name: c.clients?.name || 'Cliente',
        created_at: c.created_at
      }))

      setPendingContracts(contracts)
    } catch (error) {
      console.error('Error loading pending contracts:', error)
    }
  }

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL)
    toast({
      title: "Copiado!",
      description: "URL do webhook copiada para a área de transferência",
    })
  }

  const handleTestWebhook = async () => {
    if (!selectedContract) {
      toast({
        title: "Selecione um contrato",
        description: "Escolha um contrato pendente para simular a assinatura",
        variant: "destructive",
      })
      return
    }

    const contract = pendingContracts.find(c => c.id === selectedContract)
    if (!contract) return

    try {
      setTestingWebhook(true)

      // Chamar o webhook diretamente simulando evento de assinatura
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'document_ready',
          data: {
            document_id: contract.assinafy_document_id,
            status: 'ready'
          }
        })
      })

      const result = await response.json()

      if (response.ok && (result.ok || result.processed)) {
        toast({
          title: "Webhook processado!",
          description: `Contrato de ${contract.client_name} marcado como assinado`,
        })
        // Recarregar lista de contratos pendentes
        loadPendingContracts()
        setSelectedContract("")
      } else {
        throw new Error(result.error || 'Erro ao processar webhook')
      }
    } catch (error: any) {
      console.error('Error testing webhook:', error)
      toast({
        title: "Erro no webhook",
        description: error.message || "Erro ao testar o webhook",
        variant: "destructive",
      })
    } finally {
      setTestingWebhook(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Integração Assinafy</CardTitle>
          <CardDescription>
            Configure a integração com Assinafy para assinatura digital de contratos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Integração Assinafy
          {isConfigured ? (
            <Badge variant="default" className="text-green-700 bg-green-100">
              <CheckCircle className="w-3 h-3 mr-1" />
              Configurado
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-red-700 bg-red-100">
              <XCircle className="w-3 h-3 mr-1" />
              Não configurado
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Configure a integração com Assinafy para assinatura digital de contratos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="assinafy-api-key">Chave da API</Label>
          <Input
            id="assinafy-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Sua chave da API do Assinafy"
          />
          <p className="text-sm text-muted-foreground">
            Encontre sua chave da API em: Minha Conta → API
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assinafy-workspace-id">ID do Workspace</Label>
          <Input
            id="assinafy-workspace-id"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            placeholder="ID do seu workspace"
          />
          <p className="text-sm text-muted-foreground">
            Encontre o ID do workspace em: Minha Conta → Workspaces
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handleSaveSettings}
            disabled={loading || !apiKey.trim() || !workspaceId.trim()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Configurações
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleTestConnection}
            disabled={testing || !apiKey.trim() || !workspaceId.trim()}
          >
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <TestTube className="mr-2 h-4 w-4" />
            Testar Conexão
          </Button>
        </div>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Como configurar:</h4>
          <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
            <li>Acesse sua conta no <a href="https://app.assinafy.com.br" target="_blank" rel="noopener noreferrer" className="underline">Assinafy</a></li>
            <li>Vá em "Minha Conta" → "API" e gere uma chave</li>
            <li>Em "Workspaces", copie o ID do workspace desejado</li>
            <li>Cole ambos os valores acima e salve</li>
          </ol>
        </div>

        {isConfigured && (
          <>
            <Separator className="my-6" />

            {/* Seção Webhook */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Webhook className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-medium">Configuração do Webhook</h3>
              </div>

              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <div className="flex gap-2">
                  <Input
                    value={WEBHOOK_URL}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Configure esta URL no painel da Assinafy: Configurações → Webhooks
                </p>
              </div>

              <Separator className="my-4" />

              {/* Testar Webhook */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <TestTube className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">Testar Webhook</h3>
                </div>

                {pendingContracts.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      <Label>Contrato para testar</Label>
                      <Select value={selectedContract} onValueChange={setSelectedContract}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um contrato pendente" />
                        </SelectTrigger>
                        <SelectContent>
                          {pendingContracts.map((contract) => (
                            <SelectItem key={contract.id} value={contract.id}>
                              {contract.client_name} - {new Date(contract.created_at).toLocaleDateString('pt-BR')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        Isto marcará o contrato como assinado! Use apenas para testes.
                      </p>
                    </div>

                    <Button
                      onClick={handleTestWebhook}
                      disabled={testingWebhook || !selectedContract}
                      variant="outline"
                      className="w-full"
                    >
                      {testingWebhook && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Webhook className="mr-2 h-4 w-4" />
                      Simular Assinatura
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum contrato pendente com documento Assinafy encontrado.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}