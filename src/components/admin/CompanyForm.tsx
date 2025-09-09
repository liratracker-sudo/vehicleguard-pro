import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface CompanyFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  company?: any
  onSaved: () => void
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
    domain: company?.domain || '',
    address: company?.address || '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (company) {
        // Atualizar empresa existente
        const { name, slug, email, phone, domain, address } = formData
        const { error } = await supabase
          .from('companies')
          .update({ name, slug, email, phone, domain, address })
          .eq('id', company.id)

        if (error) throw error

        toast({
          title: "Sucesso",
          description: "Empresa atualizada com sucesso"
        })
      } else {
        // Criar nova empresa
        const { name, slug, email, phone, domain, address } = formData
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert([{ name, slug, email, phone, domain, address }])
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
          domain: '',
          address: '',
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

  useEffect(() => {
    if (open && !company) {
      loadPlans()
    }
  }, [open, company])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome da Empresa *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Nome da empresa"
              required
            />
          </div>

          <div>
            <Label htmlFor="slug">Slug (Identificador único) *</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="slug-da-empresa"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Usado para URLs e identificação no sistema
            </p>
          </div>

          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="contato@empresa.com"
            />
          </div>

          <div>
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="(11) 99999-9999"
            />
          </div>

          <div>
            <Label htmlFor="domain">Domínio</Label>
            <Input
              id="domain"
              value={formData.domain}
              onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
              placeholder="empresa.com.br"
            />
          </div>

          <div>
            <Label htmlFor="address">Endereço</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Endereço completo da empresa"
              rows={3}
            />
          </div>

          {!company && (
            <div>
              <Label htmlFor="plan_id">Plano de Assinatura</Label>
              <Select
                value={formData.plan_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, plan_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um plano (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem plano</SelectItem>
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