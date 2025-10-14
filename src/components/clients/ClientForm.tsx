import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface ClientFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  clientId?: string
}

export function ClientForm({ onSuccess, onCancel, clientId }: ClientFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    document: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    address: "",
    status: "active"
  })
  
  const [loading, setLoading] = useState(false)
  const [loadingCep, setLoadingCep] = useState(false)
  const { toast } = useToast()

  // Carregar dados do cliente se estiver editando
  useEffect(() => {
    if (clientId) {
      loadClient()
    }
  }, [clientId])

  const loadClient = async () => {
    if (!clientId) return
    
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()

      if (error) throw error

      const addressData = data.address ? JSON.parse(data.address) : {}
      
      setFormData({
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        document: data.document || "",
        cep: addressData.cep || "",
        street: addressData.street || "",
        number: addressData.number || "",
        complement: addressData.complement || "",
        neighborhood: addressData.neighborhood || "",
        city: addressData.city || "",
        state: addressData.state || "",
        address: data.address || "",
        status: data.status || "active"
      })
    } catch (error: any) {
      console.error('Erro ao carregar cliente:', error)
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do cliente",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDocument = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    
    // Format as CPF (000.000.000-00) or CNPJ (00.000.000/0000-00)
    if (digits.length <= 11) {
      // CPF
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    } else {
      // CNPJ
      return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    }
  }

  const formatPhone = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    
    // Format as (00) 00000-0000
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }

  const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, '')
    return digits.replace(/(\d{5})(\d{3})/, '$1-$2')
  }

  const searchCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '')
    
    if (cleanCep.length !== 8) return
    
    setLoadingCep(true)
    
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`)
      
      if (!response.ok) throw new Error('CEP não encontrado')
      
      const data = await response.json()
      
      setFormData(prev => ({
        ...prev,
        street: data.street || "",
        neighborhood: data.neighborhood || "",
        city: data.city || "",
        state: data.state || ""
      }))
      
      toast({
        title: "CEP encontrado",
        description: "Endereço preenchido automaticamente"
      })
    } catch (error: any) {
      toast({
        title: "Erro ao buscar CEP",
        description: error.message || "CEP inválido ou não encontrado",
        variant: "destructive"
      })
    } finally {
      setLoadingCep(false)
    }
  }

  const handleCepChange = (value: string) => {
    const formatted = formatCep(value)
    setFormData({...formData, cep: formatted})
    
    if (formatted.replace(/\D/g, '').length === 8) {
      searchCep(formatted)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile?.company_id) throw new Error('Perfil da empresa não encontrado')

      const addressData = {
        cep: formData.cep.trim(),
        street: formData.street.trim(),
        number: formData.number.trim(),
        complement: formData.complement.trim(),
        neighborhood: formData.neighborhood.trim(),
        city: formData.city.trim(),
        state: formData.state.trim()
      }

      const clientData = {
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim(),
        document: formData.document.trim() || null,
        address: JSON.stringify(addressData),
        status: formData.status,
        company_id: profile.company_id
      }

      const { error } = clientId 
        ? await supabase.from('clients').update(clientData).eq('id', clientId)
        : await supabase.from('clients').insert(clientData)

      if (error) throw error

      toast({
        title: clientId ? "Cliente atualizado" : "Cliente cadastrado",
        description: "Operação realizada com sucesso!"
      })

      onSuccess?.()
    } catch (error: any) {
      console.error('Error:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar cliente",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{clientId ? 'Editar' : 'Cadastrar'} Cliente</CardTitle>
        <CardDescription>
          Preencha os dados do cliente para o sistema de rastreamento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome Completo *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="João da Silva"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="joao@email.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: formatPhone(e.target.value)})}
                placeholder="(11) 99999-9999"
                maxLength={15}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="document">CPF/CNPJ</Label>
            <Input
              id="document"
              value={formData.document}
              onChange={(e) => setFormData({...formData, document: formatDocument(e.target.value)})}
              placeholder="000.000.000-00"
              maxLength={18}
            />
          </div>

          <div>
            <Label htmlFor="cep">CEP *</Label>
            <Input
              id="cep"
              value={formData.cep}
              onChange={(e) => handleCepChange(e.target.value)}
              placeholder="00000-000"
              maxLength={9}
              disabled={loadingCep}
              required
            />
            {loadingCep && <p className="text-xs text-muted-foreground mt-1">Buscando CEP...</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label htmlFor="street">Rua/Avenida *</Label>
              <Input
                id="street"
                value={formData.street}
                onChange={(e) => setFormData({...formData, street: e.target.value})}
                placeholder="Rua das Flores"
                required
              />
            </div>
            <div>
              <Label htmlFor="number">Número *</Label>
              <Input
                id="number"
                value={formData.number}
                onChange={(e) => setFormData({...formData, number: e.target.value})}
                placeholder="123"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="complement">Complemento</Label>
            <Input
              id="complement"
              value={formData.complement}
              onChange={(e) => setFormData({...formData, complement: e.target.value})}
              placeholder="Apt 45, Bloco B"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="neighborhood">Bairro *</Label>
              <Input
                id="neighborhood"
                value={formData.neighborhood}
                onChange={(e) => setFormData({...formData, neighborhood: e.target.value})}
                placeholder="Centro"
                required
              />
            </div>
            <div>
              <Label htmlFor="city">Cidade *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                placeholder="São Paulo"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="state">Estado *</Label>
            <Input
              id="state"
              value={formData.state}
              onChange={(e) => setFormData({...formData, state: e.target.value.toUpperCase()})}
              placeholder="SP"
              maxLength={2}
              required
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : clientId ? "Atualizar" : "Cadastrar"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}