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

      let addressData: any = {}
      
      // Tentar parsear como JSON (formato do sistema)
      if (data.address) {
        try {
          addressData = JSON.parse(data.address)
        } catch {
          // Se não for JSON, é uma string simples (importado do Asaas)
          // Deixa os campos vazios para o usuário preencher
          console.log('Endereço em formato texto:', data.address)
        }
      }
      
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
      <CardHeader className="p-4 pb-3">
        <CardTitle className="text-lg">{clientId ? 'Editar' : 'Cadastrar'} Cliente</CardTitle>
        <CardDescription className="text-xs">
          Preencha os dados do cliente para o sistema de rastreamento
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="name" className="text-sm">Nome Completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="João da Silva"
                className="h-9"
                required
              />
            </div>
            <div>
              <Label htmlFor="status" className="text-sm">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="suspended">Suspenso</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="email" className="text-sm">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="joao@email.com"
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-sm">Telefone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: formatPhone(e.target.value)})}
                placeholder="(11) 99999-9999"
                maxLength={15}
                className="h-9"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="document" className="text-sm">CPF/CNPJ</Label>
              <Input
                id="document"
                value={formData.document}
                onChange={(e) => setFormData({...formData, document: formatDocument(e.target.value)})}
                placeholder="000.000.000-00"
                maxLength={18}
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="cep" className="text-sm">CEP *</Label>
              <Input
                id="cep"
                value={formData.cep}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="00000-000"
                maxLength={9}
                disabled={loadingCep}
                className="h-9"
                required
              />
              {loadingCep && <p className="text-xs text-muted-foreground mt-1">Buscando CEP...</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <Label htmlFor="street" className="text-sm">Rua/Avenida *</Label>
              <Input
                id="street"
                value={formData.street}
                onChange={(e) => setFormData({...formData, street: e.target.value})}
                placeholder="Rua das Flores"
                className="h-9"
                required
              />
            </div>
            <div>
              <Label htmlFor="number" className="text-sm">Número *</Label>
              <Input
                id="number"
                value={formData.number}
                onChange={(e) => setFormData({...formData, number: e.target.value})}
                placeholder="123"
                className="h-9"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="complement" className="text-sm">Complemento</Label>
              <Input
                id="complement"
                value={formData.complement}
                onChange={(e) => setFormData({...formData, complement: e.target.value})}
                placeholder="Apt 45, Bloco B"
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="neighborhood" className="text-sm">Bairro *</Label>
              <Input
                id="neighborhood"
                value={formData.neighborhood}
                onChange={(e) => setFormData({...formData, neighborhood: e.target.value})}
                placeholder="Centro"
                className="h-9"
                required
              />
            </div>
            <div>
              <Label htmlFor="city" className="text-sm">Cidade *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                placeholder="São Paulo"
                className="h-9"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="state" className="text-sm">Estado *</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({...formData, state: e.target.value.toUpperCase()})}
                placeholder="SP"
                maxLength={2}
                className="h-9"
                required
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading} size="sm">
              {loading ? "Salvando..." : clientId ? "Atualizar" : "Cadastrar"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} size="sm">
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
