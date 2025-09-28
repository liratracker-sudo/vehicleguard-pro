import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Palette, Globe, Mail, FileText, Upload, Save, X } from "lucide-react"

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [config, setConfig] = useState<WhiteLabelConfig>({
    company_id: companyId,
    primary_color: '#3b82f6',
    secondary_color: '#f8fafc'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

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

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um arquivo de imagem",
        variant: "destructive"
      })
      return
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Erro", 
        description: "O arquivo deve ter no máximo 2MB",
        variant: "destructive"
      })
      return
    }

    try {
      setUploading(true)

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${companyId}/logo-${Date.now()}.${fileExt}`

      // Upload to storage
      const { data, error } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName)

      // Update config with new logo URL
      updateConfig('logo_url', publicUrl)

      toast({
        title: "Sucesso",
        description: "Logo enviado com sucesso!"
      })

    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeLogo = async () => {
    if (config.logo_url) {
      try {
        // Extract filename from URL if it's from our storage
        const urlParts = config.logo_url.split('/')
        const fileName = urlParts[urlParts.length - 1]
        
        if (config.logo_url.includes('supabase')) {
          await supabase.storage
            .from('company-logos')
            .remove([`${companyId}/${fileName}`])
        }
      } catch (error) {
        // Ignore storage deletion errors, just remove from config
        console.warn('Error removing logo from storage:', error)
      }
    }
    
    updateConfig('logo_url', '')
    toast({
      title: "Sucesso",
      description: "Logo removido!"
    })
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
                <Label>Logo da Empresa</Label>
                <div className="space-y-4">
                  {config.logo_url ? (
                    <div className="space-y-2">
                      <div className="relative inline-block">
                        <img
                          src={config.logo_url}
                          alt="Preview do logo"
                          className="h-20 object-contain border rounded p-2"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                          onClick={removeLogo}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Alterar Logo
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                      <div className="text-center">
                        <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                        <div className="mt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                          >
                            {uploading ? 'Enviando...' : 'Fazer Upload do Logo'}
                          </Button>
                          <p className="text-sm text-muted-foreground mt-2">
                            PNG, JPG até 2MB. Recomendado: 200x60px
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  
                  <div>
                    <Label htmlFor="logo_url">Ou URL do Logo</Label>
                    <Input
                      id="logo_url"
                      value={config.logo_url || ''}
                      onChange={(e) => updateConfig('logo_url', e.target.value)}
                      placeholder="https://exemplo.com/logo.png"
                    />
                  </div>
                </div>
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