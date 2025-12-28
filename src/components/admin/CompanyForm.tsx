import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Globe, AlertCircle } from "lucide-react"

interface CompanyFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  company?: any
  onSaved: () => void
}

// Sanitizar domínio - remove protocolo e barras extras
const sanitizeDomain = (input: string): string => {
  if (!input || !input.trim()) return ''
  // Remove protocolo se digitado (http, https, com variações de : e /)
  let domain = input.replace(/^https?:+\/+/i, '').trim()
  // Remove barras finais
  domain = domain.replace(/\/+$/, '')
  // Remove espaços
  domain = domain.replace(/\s+/g, '')
  return domain
}

// Gerar domínio completo com https://
const getFullDomain = (domain: string): string => {
  const sanitized = sanitizeDomain(domain)
  return sanitized ? `https://${sanitized}` : ''
}

export function CompanyForm({ open, onOpenChange, company, onSaved }: CompanyFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [plans, setPlans] = useState<any[]>([])
  const [formData, setFormData] = useState({
    name: company?.name || '',
    slug: company?.slug || '',
    email: company?.email || '',
    phone: company?.phone || '',
    address: company?.address || '',
    domain: '',
    plan_id: ''
  })

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, price_monthly')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true })

      if (error) throw error
      setPlans(data || [])
    } catch (error: any) {
      console.error('Erro ao carregar planos:', error)
    }
  }

  const generateSlug = (name: string) => {
    return name.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: !company ? generateSlug(name) : prev.slug
    }))
  }

  const handleDomainChange = (value: string) => {
    // Sanitizar em tempo real para preview
    setFormData(prev => ({ ...prev, domain: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Sanitizar domínio antes de salvar
      const fullDomain = getFullDomain(formData.domain)

      if (company) {
        // Atualizar empresa existente
        const { name, slug, email, phone, address } = formData
        const updateData: any = { name, slug, email, phone, address }
        
        // Só atualiza domínio se foi preenchido
        if (fullDomain) {
          updateData.domain = fullDomain
        }

        const { error } = await supabase
          .from('companies')
          .update(updateData)
          .eq('id', company.id)

        if (error) throw error

        toast({
          title: "Sucesso",
          description: "Empresa atualizada com sucesso"
        })
      } else {
        // Criar nova empresa
        const { name, slug, email, phone, address } = formData
        const insertData: any = { name, slug, email, phone, address }
        
        // Adiciona domínio se preenchido
        if (fullDomain) {
          insertData.domain = fullDomain
        }

        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert([insertData])
          .select('id')
          .single()

        if (companyError) throw companyError

        // Se um plano foi selecionado, criar assinatura
        if (formData.plan_id && newCompany) {
          const { error: subscriptionError } = await supabase
            .from('company_subscriptions')
            .insert([{
              company_id: newCompany.id,
              plan_id: formData.plan_id,
              status: 'active',
              auto_renew: true,
              started_at: new Date().toISOString()
            }])

          if (subscriptionError) throw subscriptionError
        }

        toast({
          title: "Sucesso", 
          description: "Empresa criada com sucesso"
        })
      }

      onSaved()
      onOpenChange(false)
      
      // Reset form para nova empresa
      if (!company) {
        setFormData({
          name: '',
          slug: '',
          email: '',
          phone: '',
          address: '',
          domain: '',
          plan_id: ''
        })
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  // Preview do link de pagamento
  const getPaymentLinkPreview = () => {
    const sanitized = sanitizeDomain(formData.domain)
    if (!sanitized) return null
    return `https://${sanitized}/checkout/[id-cobranca]`
  }

  useEffect(() => {
    if (open && !company) {
      loadPlans()
    }
  }, [open, company])

  // Atualizar formData quando company mudar (para edição)
  useEffect(() => {
    if (company) {
      // Extrair domínio sem https:// para exibição
      const domainWithoutProtocol = company.domain 
        ? company.domain.replace(/^https?:+\/+/i, '')
        : ''
      
      setFormData({
        name: company.name || '',
        slug: company.slug || '',
        email: company.email || '',
        phone: company.phone || '',
        address: company.address || '',
        domain: domainWithoutProtocol,
        plan_id: ''
      })
    } else {
      setFormData({
        name: '',
        slug: '',
        email: '',
        phone: '',
        address: '',
        domain: '',
        plan_id: ''
      })
    }
  }, [company])

  const paymentPreview = getPaymentLinkPreview()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {company ? 'Editar Empresa' : 'Nova Empresa'}
          </DialogTitle>
          <DialogDescription>
            {company 
              ? 'Edite as informações da empresa'
              : 'Cadastre uma nova empresa no sistema'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="name">Nome da Empresa *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Nome da empresa"
              required
              className="h-9"
            />
          </div>

          <div>
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="slug-da-empresa"
              required
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="contato@empresa.com"
                className="h-9"
              />
            </div>

            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
                className="h-9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address">Endereço</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Endereço completo"
              rows={2}
            />
          </div>

          {/* Campo de Domínio Personalizado */}
          <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <Label htmlFor="domain" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Domínio Personalizado
            </Label>
            <Input
              id="domain"
              value={formData.domain}
              onChange={(e) => handleDomainChange(e.target.value)}
              placeholder="app.empresa.com.br"
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">
              Digite apenas o domínio (sem https://). Exemplo: app.minhaempresa.com.br
            </p>
            
            {paymentPreview && (
              <div className="flex items-start gap-2 p-2 rounded bg-primary/10 border border-primary/20">
                <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-medium text-primary">Preview do link de pagamento:</p>
                  <code className="text-foreground break-all">{paymentPreview}</code>
                </div>
              </div>
            )}
          </div>

          {!company && (
            <div>
              <Label htmlFor="plan_id">Plano de Assinatura</Label>
              <Select
                value={formData.plan_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, plan_id: value === 'none' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um plano (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem plano</SelectItem>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - {formatCurrency(plan.price_monthly)}/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Você pode associar ou alterar o plano depois
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : (company ? 'Atualizar' : 'Criar')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
