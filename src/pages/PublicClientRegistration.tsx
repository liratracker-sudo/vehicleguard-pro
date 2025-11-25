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
import { Upload, CheckCircle2 } from "lucide-react"

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
    vehicle_plate: "",
    vehicle_brand: "",
    vehicle_model: "",
    vehicle_year: "",
    vehicle_color: "",
    has_gnv: false,
    is_armored: false,
  })

  const [documentFront, setDocumentFront] = useState<File | null>(null)
  const [documentBack, setDocumentBack] = useState<File | null>(null)

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
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf
          }))
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const formDataToSend = new FormData()
      
      // Adicionar todos os campos
      Object.entries(formData).forEach(([key, value]) => {
        formDataToSend.append(key, String(value))
      })
      
      formDataToSend.append('company_id', companyInfo.id)
      if (documentFront) formDataToSend.append('document_front', documentFront)
      if (documentBack) formDataToSend.append('document_back', documentBack)

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
          {/* Documentos */}
          <Card>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
              <CardDescription>Envie fotos da CNH ou RG (frente e verso) - Opcional</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>CNH/RG - Frente</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setDocumentFront(e.target.files?.[0] || null)}
                />
              </div>
              <div>
                <Label>CNH/RG - Verso</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setDocumentBack(e.target.files?.[0] || null)}
                />
              </div>
            </CardContent>
          </Card>

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
                  <Label>CPF *</Label>
                  <Input
                    value={formData.document}
                    onChange={(e) => {
                      let value = e.target.value.replace(/\D/g, '')
                      if (value.length <= 11) {
                        value = value.replace(/(\d{3})(\d)/, '$1.$2')
                        value = value.replace(/(\d{3})(\d)/, '$1.$2')
                        value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
                      }
                      setFormData({ ...formData, document: value })
                    }}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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

          {/* Dados do Veículo */}
          <Card>
            <CardHeader>
              <CardTitle>Dados do Veículo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Placa *</Label>
                  <Input
                    value={formData.vehicle_plate}
                    onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value.toUpperCase() })}
                    placeholder="ABC1D23"
                    required
                  />
                </div>
                <div>
                  <Label>Marca *</Label>
                  <Input
                    value={formData.vehicle_brand}
                    onChange={(e) => setFormData({ ...formData, vehicle_brand: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Modelo *</Label>
                  <Input
                    value={formData.vehicle_model}
                    onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Ano *</Label>
                  <Input
                    type="number"
                    value={formData.vehicle_year}
                    onChange={(e) => setFormData({ ...formData, vehicle_year: e.target.value })}
                    min="1900"
                    max="2099"
                    required
                  />
                </div>
                <div>
                  <Label>Cor *</Label>
                  <Input
                    value={formData.vehicle_color}
                    onChange={(e) => setFormData({ ...formData, vehicle_color: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has_gnv"
                    checked={formData.has_gnv}
                    onCheckedChange={(checked) => setFormData({ ...formData, has_gnv: checked as boolean })}
                  />
                  <Label htmlFor="has_gnv">Possui GNV</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_armored"
                    checked={formData.is_armored}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_armored: checked as boolean })}
                  />
                  <Label htmlFor="is_armored">Blindado</Label>
                </div>
              </div>
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