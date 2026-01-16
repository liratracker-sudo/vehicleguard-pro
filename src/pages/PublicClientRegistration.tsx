import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle2, Plus, Trash2, Car } from "lucide-react"

interface Vehicle {
  id: string
  plate: string
  brand: string
  model: string
  year: string
  color: string
  has_gnv: boolean
  is_armored: boolean
}

const createEmptyVehicle = (): Vehicle => ({
  id: crypto.randomUUID(),
  plate: "",
  brand: "",
  model: "",
  year: "",
  color: "",
  has_gnv: false,
  is_armored: false
})

export default function PublicClientRegistration() {
  const { company_slug } = useParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [registrationId, setRegistrationId] = useState("")
  const [companyInfo, setCompanyInfo] = useState<any>(null)

  const [formData, setFormData] = useState({
    name: "",
    birth_date: "",
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
    emergency_contact_name: "",
    emergency_contact_relationship: "",
    emergency_contact_phone: "",
  })

  const [vehicles, setVehicles] = useState<Vehicle[]>([createEmptyVehicle()])

  const MAX_VEHICLES = 5

  useEffect(() => {
    loadCompanyInfo()
  }, [company_slug])

  const loadCompanyInfo = async () => {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, logo_url, primary_color')
      .eq('slug', company_slug)
      .single()

    if (error || !data) {
      toast({
        title: "Erro",
        description: "Empresa não encontrada",
        variant: "destructive"
      })
      return
    }

    setCompanyInfo(data)
  }

  const handleCepBlur = async () => {
    const cepNumeros = formData.cep.replace(/\D/g, '')
    if (cepNumeros.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepNumeros}/json/`)
        const data = await response.json()
        
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            street: (data.logradouro || '').toUpperCase(),
            neighborhood: (data.bairro || '').toUpperCase(),
            city: (data.localidade || '').toUpperCase(),
            state: (data.uf || '').toUpperCase()
          }))
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error)
      }
    }
  }

  const addVehicle = () => {
    if (vehicles.length < MAX_VEHICLES) {
      setVehicles([...vehicles, createEmptyVehicle()])
    }
  }

  const removeVehicle = (vehicleId: string) => {
    if (vehicles.length > 1) {
      setVehicles(vehicles.filter(v => v.id !== vehicleId))
    }
  }

  const updateVehicle = (vehicleId: string, field: keyof Vehicle, value: any) => {
    setVehicles(vehicles.map(v => 
      v.id === vehicleId ? { ...v, [field]: value } : v
    ))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validar que pelo menos um veículo está preenchido
      const validVehicles = vehicles.filter(v => v.plate.trim() && v.brand.trim() && v.model.trim())
      if (validVehicles.length === 0) {
        toast({
          title: "Erro",
          description: "Preencha os dados de pelo menos um veículo",
          variant: "destructive"
        })
        setLoading(false)
        return
      }

      // Converter dados pessoais para CAIXA ALTA
      const normalizedFormData = {
        ...formData,
        name: formData.name.toUpperCase(),
        street: formData.street.toUpperCase(),
        number: formData.number.toUpperCase(),
        complement: formData.complement.toUpperCase(),
        neighborhood: formData.neighborhood.toUpperCase(),
        city: formData.city.toUpperCase(),
        state: formData.state.toUpperCase(),
        emergency_contact_name: formData.emergency_contact_name.toUpperCase(),
      }

      // Converter dados dos veículos para CAIXA ALTA
      const normalizedVehicles = validVehicles.map(v => ({
        ...v,
        plate: v.plate.toUpperCase(),
        brand: v.brand.toUpperCase(),
        model: v.model.toUpperCase(),
        color: v.color.toUpperCase(),
      }))

      const formDataToSend = new FormData()
      
      // Adicionar todos os campos pessoais normalizados
      Object.entries(normalizedFormData).forEach(([key, value]) => {
        formDataToSend.append(key, String(value))
      })
      
      // Adicionar veículos normalizados como JSON
      formDataToSend.append('vehicles', JSON.stringify(normalizedVehicles))
      
      formDataToSend.append('company_id', companyInfo.id)

      const response = await supabase.functions.invoke('process-client-registration', {
        body: formDataToSend
      })

      if (response.error) throw response.error

      setRegistrationId(response.data.registration_id)
      setSubmitted(true)
      
      toast({
        title: "Cadastro enviado!",
        description: "Seu cadastro está em análise. Aguarde o contato da empresa."
      })

    } catch (error) {
      console.error('Error submitting registration:', error)
      toast({
        title: "Erro ao enviar cadastro",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  if (!companyInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Cadastro Enviado!</CardTitle>
            <CardDescription>
              Seu cadastro foi enviado com sucesso e está aguardando aprovação.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Número do Protocolo:</p>
              <p className="font-mono font-bold">{registrationId.slice(0, 8).toUpperCase()}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Guarde este número para acompanhamento. Você será contatado em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          {companyInfo.logo_url && (
            <img 
              src={companyInfo.logo_url} 
              alt={companyInfo.name} 
              className="h-16 mx-auto mb-4"
            />
          )}
          <h1 className="text-3xl font-bold">{companyInfo.name}</h1>
          <p className="text-muted-foreground mt-2">Formulário de Cadastro de Cliente</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados Pessoais */}
          <Card>
            <CardHeader>
              <CardTitle>Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome Completo *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Data de Nascimento *</Label>
                  <Input
                    type="text"
                    value={formData.birth_date}
                    onChange={(e) => {
                      let value = e.target.value.replace(/\D/g, '')
                      if (value.length >= 2) {
                        value = value.slice(0, 2) + '/' + value.slice(2)
                      }
                      if (value.length >= 5) {
                        value = value.slice(0, 5) + '/' + value.slice(5, 9)
                      }
                      setFormData({ ...formData, birth_date: value })
                    }}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    required
                  />
                </div>
                <div>
                  <Label>CPF/CNPJ *</Label>
                  <Input
                    value={formData.document}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '')
                      let formatted = ''
                      
                      if (digits.length <= 11) {
                        // Formato CPF: 000.000.000-00
                        formatted = digits
                        if (digits.length > 3) formatted = digits.slice(0, 3) + '.' + digits.slice(3)
                        if (digits.length > 6) formatted = formatted.slice(0, 7) + '.' + digits.slice(6)
                        if (digits.length > 9) formatted = formatted.slice(0, 11) + '-' + digits.slice(9)
                      } else {
                        // Formato CNPJ: 00.000.000/0000-00
                        formatted = digits.slice(0, 2)
                        if (digits.length > 2) formatted += '.' + digits.slice(2, 5)
                        if (digits.length > 5) formatted += '.' + digits.slice(5, 8)
                        if (digits.length > 8) formatted += '/' + digits.slice(8, 12)
                        if (digits.length > 12) formatted += '-' + digits.slice(12, 14)
                      }
                      
                      setFormData({ ...formData, document: formatted })
                    }}
                    placeholder="CPF ou CNPJ"
                    maxLength={18}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Telefone *</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => {
                      let value = e.target.value.replace(/\D/g, '')
                      if (value.length <= 11) {
                        value = value.replace(/^(\d{2})(\d)/g, '($1) $2')
                        value = value.replace(/(\d)(\d{4})$/, '$1-$2')
                      }
                      setFormData({ ...formData, phone: value })
                    }}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Endereço */}
          <Card>
            <CardHeader>
              <CardTitle>Endereço</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>CEP *</Label>
                  <Input
                    value={formData.cep}
                    onChange={(e) => {
                      let value = e.target.value.replace(/\D/g, '')
                      if (value.length <= 8) {
                        value = value.replace(/^(\d{5})(\d)/, '$1-$2')
                      }
                      setFormData({ ...formData, cep: value })
                    }}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                    maxLength={9}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Rua *</Label>
                  <Input
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Número *</Label>
                  <Input
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Complemento</Label>
                  <Input
                    value={formData.complement}
                    onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Bairro *</Label>
                  <Input
                    value={formData.neighborhood}
                    onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Cidade *</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Estado *</Label>
                  <Input
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    maxLength={2}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contato de Emergência */}
          <Card>
            <CardHeader>
              <CardTitle>Contato de Emergência</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome do Contato *</Label>
                  <Input
                    value={formData.emergency_contact_name}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Grau de Parentesco *</Label>
                  <Select
                    value={formData.emergency_contact_relationship}
                    onValueChange={(value) => setFormData({ ...formData, emergency_contact_relationship: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pai">Pai</SelectItem>
                      <SelectItem value="Mãe">Mãe</SelectItem>
                      <SelectItem value="Cônjuge">Cônjuge</SelectItem>
                      <SelectItem value="Irmão(ã)">Irmão(ã)</SelectItem>
                      <SelectItem value="Filho(a)">Filho(a)</SelectItem>
                      <SelectItem value="Amigo(a)">Amigo(a)</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Telefone do Contato *</Label>
                <Input
                  value={formData.emergency_contact_phone}
                  onChange={(e) => {
                    let value = e.target.value.replace(/\D/g, '')
                    if (value.length <= 11) {
                      value = value.replace(/^(\d{2})(\d)/g, '($1) $2')
                      value = value.replace(/(\d)(\d{4})$/, '$1-$2')
                    }
                    setFormData({ ...formData, emergency_contact_phone: value })
                  }}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Dados dos Veículos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Dados dos Veículos
              </CardTitle>
              <CardDescription>
                Cadastre até {MAX_VEHICLES} veículos por formulário
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {vehicles.map((vehicle, index) => (
                <div key={vehicle.id} className="p-4 border rounded-lg space-y-4 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Veículo {index + 1} de {vehicles.length}
                    </span>
                    {vehicles.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVehicle(vehicle.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remover
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Placa *</Label>
                      <Input
                        value={vehicle.plate}
                        onChange={(e) => updateVehicle(vehicle.id, 'plate', e.target.value.toUpperCase())}
                        placeholder="ABC1D23"
                        required={index === 0}
                      />
                    </div>
                    <div>
                      <Label>Marca *</Label>
                      <Input
                        value={vehicle.brand}
                        onChange={(e) => updateVehicle(vehicle.id, 'brand', e.target.value)}
                        required={index === 0}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Modelo *</Label>
                      <Input
                        value={vehicle.model}
                        onChange={(e) => updateVehicle(vehicle.id, 'model', e.target.value)}
                        required={index === 0}
                      />
                    </div>
                    <div>
                      <Label>Ano *</Label>
                      <Input
                        type="number"
                        value={vehicle.year}
                        onChange={(e) => updateVehicle(vehicle.id, 'year', e.target.value)}
                        min="1900"
                        max="2099"
                        required={index === 0}
                      />
                    </div>
                    <div>
                      <Label>Cor *</Label>
                      <Input
                        value={vehicle.color}
                        onChange={(e) => updateVehicle(vehicle.id, 'color', e.target.value)}
                        required={index === 0}
                      />
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`has_gnv_${vehicle.id}`}
                        checked={vehicle.has_gnv}
                        onCheckedChange={(checked) => updateVehicle(vehicle.id, 'has_gnv', checked as boolean)}
                      />
                      <Label htmlFor={`has_gnv_${vehicle.id}`}>Possui GNV</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`is_armored_${vehicle.id}`}
                        checked={vehicle.is_armored}
                        onCheckedChange={(checked) => updateVehicle(vehicle.id, 'is_armored', checked as boolean)}
                      />
                      <Label htmlFor={`is_armored_${vehicle.id}`}>Blindado</Label>
                    </div>
                  </div>
                </div>
              ))}

              {vehicles.length < MAX_VEHICLES && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addVehicle}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar outro veículo
                </Button>
              )}
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Enviando..." : "Enviar Cadastro"}
          </Button>
        </form>
      </div>
    </div>
  )
}
