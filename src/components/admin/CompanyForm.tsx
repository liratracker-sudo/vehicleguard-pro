import { useState } from "react"
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
  const [formData, setFormData] = useState({
    name: company?.name || '',
    slug: company?.slug || '',
    email: company?.email || '',
    phone: company?.phone || '',
    domain: company?.domain || '',
    address: company?.address || ''
  })

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
        const { error } = await supabase
          .from('companies')
          .update(formData)
          .eq('id', company.id)

        if (error) throw error

        toast({
          title: "Sucesso",
          description: "Empresa atualizada com sucesso"
        })
      } else {
        // Criar nova empresa
        const { error } = await supabase
          .from('companies')
          .insert([formData])

        if (error) throw error

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
          address: ''
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