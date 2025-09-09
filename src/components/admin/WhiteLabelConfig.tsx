import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Palette, Globe, Mail, FileText, Upload, Save } from "lucide-react"

interface WhiteLabelConfig {
  id?: string
  company_id: string
  logo_url?: string
  primary_color: string
  secondary_color: string
  favicon_url?: string
  subdomain?: string
  smtp_host?: string
  smtp_port?: number
  smtp_user?: string
  smtp_password?: string
  smtp_from_email?: string
  smtp_from_name?: string
  terms_of_service?: string
  privacy_policy?: string
}

interface WhiteLabelConfigProps {
  companyId: string
  companyName: string
  onClose: () => void
}

export function WhiteLabelConfig({ companyId, companyName, onClose }: WhiteLabelConfigProps) {
  const { toast } = useToast()
  const [config, setConfig] = useState<WhiteLabelConfig>({
    company_id: companyId,
    primary_color: '#3b82f6',
    secondary_color: '#f8fafc'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('company_branding')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        setConfig(data)
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    try {
      setSaving(true)

      const { error } = await supabase
        .from('company_branding')
        .upsert(config, { onConflict: 'company_id' })

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Configurações de white-label salvas com sucesso!"
      })

      onClose()
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

  const updateConfig = (field: keyof WhiteLabelConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    loadConfig()
  }, [companyId])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Configuração White-Label</h2>
          <p className="text-muted-foreground">
            Configure a identidade visual de <strong>{companyName}</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={saveConfig} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="w-4 h-4" />
            Visual
          </TabsTrigger>
          <TabsTrigger value="domain" className="gap-2">
            <Globe className="w-4 h-4" />
            Domínio
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="w-4 h-4" />
            E-mail
          </TabsTrigger>
          <TabsTrigger value="legal" className="gap-2">
            <FileText className="w-4 h-4" />
            Documentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Identidade Visual</CardTitle>
              <CardDescription>
                Configure cores, logo e favicon da empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primary_color">Cor Primária</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary_color"
                      type="color"
                      value={config.primary_color}
                      onChange={(e) => updateConfig('primary_color', e.target.value)}
                      className="w-16 h-10"
                    />
                    <Input
                      value={config.primary_color}
                      onChange={(e) => updateConfig('primary_color', e.target.value)}
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="secondary_color">Cor Secundária</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary_color"
                      type="color"
                      value={config.secondary_color}
                      onChange={(e) => updateConfig('secondary_color', e.target.value)}
                      className="w-16 h-10"
                    />
                    <Input
                      value={config.secondary_color}
                      onChange={(e) => updateConfig('secondary_color', e.target.value)}
                      placeholder="#f8fafc"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="logo_url">URL do Logo</Label>
                <Input
                  id="logo_url"
                  value={config.logo_url || ''}
                  onChange={(e) => updateConfig('logo_url', e.target.value)}
                  placeholder="https://exemplo.com/logo.png"
                />
                {config.logo_url && (
                  <div className="mt-2">
                    <img
                      src={config.logo_url}
                      alt="Preview do logo"
                      className="h-12 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="favicon_url">URL do Favicon</Label>
                <Input
                  id="favicon_url"
                  value={config.favicon_url || ''}
                  onChange={(e) => updateConfig('favicon_url', e.target.value)}
                  placeholder="https://exemplo.com/favicon.ico"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="domain" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuração de Domínio</CardTitle>
              <CardDescription>
                Configure subdomínio personalizado para a empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="subdomain">Subdomínio</Label>
                <Input
                  id="subdomain"
                  value={config.subdomain || ''}
                  onChange={(e) => updateConfig('subdomain', e.target.value)}
                  placeholder="empresa"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  URL final: {config.subdomain || 'empresa'}.seudominio.com.br
                </p>
              </div>

              {config.subdomain && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Configuração DNS</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Configure os seguintes registros DNS:
                  </p>
                  <div className="space-y-1 text-sm font-mono bg-background p-2 rounded border">
                    <div>Tipo: CNAME</div>
                    <div>Nome: {config.subdomain}</div>
                    <div>Valor: app.seudominio.com.br</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuração SMTP</CardTitle>
              <CardDescription>
                Configure servidor SMTP para envio de e-mails personalizados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smtp_host">Servidor SMTP</Label>
                  <Input
                    id="smtp_host"
                    value={config.smtp_host || ''}
                    onChange={(e) => updateConfig('smtp_host', e.target.value)}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div>
                  <Label htmlFor="smtp_port">Porta</Label>
                  <Input
                    id="smtp_port"
                    type="number"
                    value={config.smtp_port || ''}
                    onChange={(e) => updateConfig('smtp_port', parseInt(e.target.value) || undefined)}
                    placeholder="587"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smtp_user">Usuário SMTP</Label>
                  <Input
                    id="smtp_user"
                    value={config.smtp_user || ''}
                    onChange={(e) => updateConfig('smtp_user', e.target.value)}
                    placeholder="usuario@empresa.com"
                  />
                </div>
                <div>
                  <Label htmlFor="smtp_password">Senha SMTP</Label>
                  <Input
                    id="smtp_password"
                    type="password"
                    value={config.smtp_password || ''}
                    onChange={(e) => updateConfig('smtp_password', e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smtp_from_email">E-mail Remetente</Label>
                  <Input
                    id="smtp_from_email"
                    type="email"
                    value={config.smtp_from_email || ''}
                    onChange={(e) => updateConfig('smtp_from_email', e.target.value)}
                    placeholder="noreply@empresa.com"
                  />
                </div>
                <div>
                  <Label htmlFor="smtp_from_name">Nome Remetente</Label>
                  <Input
                    id="smtp_from_name"
                    value={config.smtp_from_name || ''}
                    onChange={(e) => updateConfig('smtp_from_name', e.target.value)}
                    placeholder="Empresa Rastreamento"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Documentos Legais</CardTitle>
              <CardDescription>
                Configure termos de uso e política de privacidade personalizados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="terms_of_service">Termos de Uso</Label>
                <Textarea
                  id="terms_of_service"
                  value={config.terms_of_service || ''}
                  onChange={(e) => updateConfig('terms_of_service', e.target.value)}
                  placeholder="Digite os termos de uso personalizados..."
                  rows={8}
                />
              </div>

              <div>
                <Label htmlFor="privacy_policy">Política de Privacidade</Label>
                <Textarea
                  id="privacy_policy"
                  value={config.privacy_policy || ''}
                  onChange={(e) => updateConfig('privacy_policy', e.target.value)}
                  placeholder="Digite a política de privacidade personalizada..."
                  rows={8}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}