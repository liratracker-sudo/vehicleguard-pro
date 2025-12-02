import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface ClientFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  clientId?: string
  readOnly?: boolean
}

export function ClientForm({ onSuccess, onCancel, clientId, readOnly = false }: ClientFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    document: "",
    birth_date: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relationship: "",
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

      // Carregar dados diretamente dos campos individuais
      setFormData({
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        document: data.document || "",
        birth_date: data.birth_date || "",
        cep: data.cep || "",
        street: data.street || "",
        number: data.number || "",
        complement: data.complement || "",
        neighborhood: data.neighborhood || "",
        city: data.city || "",
        state: data.state || "",
        emergency_contact_name: data.emergency_contact_name || "",
        emergency_contact_phone: data.emergency_contact_phone || "",
        emergency_contact_relationship: data.emergency_contact_relationship || "",
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
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 11) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    } else {
      return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    }
  }

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '')
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

      // Criar endereço formatado para retrocompatibilidade
      const formattedAddress = formData.street.trim() 
        ? `${formData.street.trim()}, ${formData.number.trim()}${formData.complement.trim() ? `, ${formData.complement.trim()}` : ''} - ${formData.neighborhood.trim()}, ${formData.city.trim()}-${formData.state.trim()}, CEP: ${formData.cep.trim()}`
        : null

      const clientData = {
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim(),
        document: formData.document.trim() || null,
        birth_date: formData.birth_date || null,
        cep: formData.cep.trim() || null,
        street: formData.street.trim() || null,
        number: formData.number.trim() || null,
        complement: formData.complement.trim() || null,
        neighborhood: formData.neighborhood.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        emergency_contact_name: formData.emergency_contact_name.trim() || null,
        emergency_contact_phone: formData.emergency_contact_phone.trim() || null,
        emergency_contact_relationship: formData.emergency_contact_relationship || null,
        address: formattedAddress,
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
        <CardTitle className="text-lg">{readOnly ? 'Visualizar' : (clientId ? 'Editar' : 'Cadastrar')} Cliente</CardTitle>
        <CardDescription className="text-xs">
          {readOnly ? 'Dados do cliente' : 'Preencha os dados do cliente para o sistema de rastreamento'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="name" className="text-sm">Nome Completo {!readOnly && '*'}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="João da Silva"
                className="h-9"
                disabled={readOnly}
                required={!readOnly}
              />
            </div>
            <div>
              <Label htmlFor="status" className="text-sm">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})} disabled={readOnly}>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="email" className="text-sm">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="joao@email.com"
                className="h-9"
                disabled={readOnly}
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-sm">Telefone {!readOnly && '*'}</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: formatPhone(e.target.value)})}
                placeholder="(11) 99999-9999"
                maxLength={15}
                className="h-9"
                disabled={readOnly}
                required={!readOnly}
              />
            </div>
            <div>
              <Label htmlFor="birth_date" className="text-sm">Data de Nascimento</Label>
              <Input
                id="birth_date"
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({...formData, birth_date: e.target.value})}
                disabled={readOnly}
                className="h-9"
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
                disabled={readOnly}
              />
            </div>
            <div>
              <Label htmlFor="cep" className="text-sm">CEP {!readOnly && '*'}</Label>
              <Input
                id="cep"
                value={formData.cep}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="00000-000"
                maxLength={9}
                disabled={readOnly || loadingCep}
                className="h-9"
                required={!readOnly}
              />
              {loadingCep && <p className="text-xs text-muted-foreground mt-1">Buscando CEP...</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <Label htmlFor="street" className="text-sm">Rua/Avenida {!readOnly && '*'}</Label>
              <Input
                id="street"
                value={formData.street}
                onChange={(e) => setFormData({...formData, street: e.target.value})}
                placeholder="Rua das Flores"
                className="h-9"
                disabled={readOnly}
                required={!readOnly}
              />
            </div>
            <div>
              <Label htmlFor="number" className="text-sm">Número {!readOnly && '*'}</Label>
              <Input
                id="number"
                value={formData.number}
                onChange={(e) => setFormData({...formData, number: e.target.value})}
                placeholder="123"
                className="h-9"
                disabled={readOnly}
                required={!readOnly}
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
                disabled={readOnly}
              />
            </div>
            <div>
              <Label htmlFor="neighborhood" className="text-sm">Bairro {!readOnly && '*'}</Label>
              <Input
                id="neighborhood"
                value={formData.neighborhood}
                onChange={(e) => setFormData({...formData, neighborhood: e.target.value})}
                placeholder="Centro"
                className="h-9"
                disabled={readOnly}
                required={!readOnly}
              />
            </div>
            <div>
              <Label htmlFor="city" className="text-sm">Cidade {!readOnly && '*'}</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                placeholder="São Paulo"
                className="h-9"
                disabled={readOnly}
                required={!readOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="state" className="text-sm">Estado {!readOnly && '*'}</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({...formData, state: e.target.value.toUpperCase()})}
                placeholder="SP"
                maxLength={2}
                className="h-9"
                disabled={readOnly}
                required={!readOnly}
              />
            </div>
          </div>

          {/* Seção Contato de Emergência */}
          <div className="pt-3 border-t border-border">
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Contato de Emergência</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="emergency_contact_name" className="text-sm">Nome</Label>
                <Input
                  id="emergency_contact_name"
                  value={formData.emergency_contact_name}
                  onChange={(e) => setFormData({...formData, emergency_contact_name: e.target.value})}
                  placeholder="Nome do contato"
                  className="h-9"
                  disabled={readOnly}
                />
              </div>
              <div>
                <Label htmlFor="emergency_contact_phone" className="text-sm">Telefone</Label>
                <Input
                  id="emergency_contact_phone"
                  value={formData.emergency_contact_phone}
                  onChange={(e) => setFormData({...formData, emergency_contact_phone: formatPhone(e.target.value)})}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                  className="h-9"
                  disabled={readOnly}
                />
              </div>
              <div>
                <Label htmlFor="emergency_contact_relationship" className="text-sm">Parentesco</Label>
                <Select 
                  value={formData.emergency_contact_relationship} 
                  onValueChange={(value) => setFormData({...formData, emergency_contact_relationship: value})}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cônjuge">Cônjuge</SelectItem>
                    <SelectItem value="Pai/Mãe">Pai/Mãe</SelectItem>
                    <SelectItem value="Filho(a)">Filho(a)</SelectItem>
                    <SelectItem value="Irmão(ã)">Irmão(ã)</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            {!readOnly && (
              <Button type="submit" disabled={loading} size="sm">
                {loading ? "Salvando..." : clientId ? "Atualizar" : "Cadastrar"}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onCancel} size="sm">
              {readOnly ? 'Fechar' : 'Cancelar'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
