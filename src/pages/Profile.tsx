import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { User, Phone, Mail, Save, Loader2, Building } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface ProfileData {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: string | null
  company_id: string | null
}

interface CompanyData {
  id: string
  name: string
  cnpj: string | null
  address: string | null
}

const ProfilePage = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [company, setCompany] = useState<CompanyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingCompany, setSavingCompany] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    phone: ''
  })
  const [companyFormData, setCompanyFormData] = useState({
    name: '',
    cnpj: '',
    address: ''
  })
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast({
          title: "Acesso restrito",
          description: "Faça login para acessar o perfil.",
          variant: "destructive",
        })
        navigate("/auth")
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, role, company_id')
        .eq('user_id', user.id)
        .single()

      if (error) throw error

      setProfile(data)
      setFormData({
        full_name: data.full_name || '',
        phone: formatPhone(data.phone || '')
      })

      // Buscar dados da empresa
      if (data?.company_id) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('id, name, cnpj, address')
          .eq('id', data.company_id)
          .single()

        if (!companyError && companyData) {
          setCompany(companyData)
          setCompanyFormData({
            name: companyData.name || '',
            cnpj: formatCNPJ(companyData.cnpj || ''),
            address: companyData.address || ''
          })
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      toast({
        title: "Erro",
        description: "Erro ao carregar perfil.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`
    if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`
    if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value)
    setFormData(prev => ({ ...prev, phone: formatted }))
  }

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value)
    setCompanyFormData(prev => ({ ...prev, cnpj: formatted }))
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!profile) return

    setSavingProfile(true)
    try {
      const cleanPhone = formData.phone.replace(/\D/g, '')

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: cleanPhone || null
        })
        .eq('id', profile.id)

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso!",
      })

      loadProfile()
    } catch (error) {
      console.error('Error updating profile:', error)
      toast({
        title: "Erro",
        description: "Erro ao atualizar perfil.",
        variant: "destructive",
      })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!company) return

    setSavingCompany(true)
    try {
      const cleanCNPJ = companyFormData.cnpj.replace(/\D/g, '')

      const { error } = await supabase
        .from('companies')
        .update({
          name: companyFormData.name,
          cnpj: cleanCNPJ || null,
          address: companyFormData.address || null
        })
        .eq('id', company.id)

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Dados da empresa atualizados!",
      })

      loadProfile()
    } catch (error) {
      console.error('Error updating company:', error)
      toast({
        title: "Erro",
        description: "Erro ao atualizar empresa.",
        variant: "destructive",
      })
    } finally {
      setSavingCompany(false)
    }
  }

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'admin': return 'Administrador'
      case 'super_admin': return 'Super Administrador'
      case 'user': return 'Usuário'
      default: return role || 'Não definido'
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Meu Perfil</h1>
          <p className="text-muted-foreground">
            Gerencie suas informações pessoais e da empresa
          </p>
        </div>

        {/* Informações Pessoais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>
              Atualize seu nome e telefone. O telefone é necessário para receber notificações via WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  O email não pode ser alterado
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Seu nome completo"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Telefone (WhatsApp)
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  placeholder="(11) 99999-9999"
                  maxLength={16}
                />
                <p className="text-xs text-muted-foreground">
                  Adicione seu número para receber notificações de novos cadastros via WhatsApp
                </p>
              </div>

              <div className="space-y-2">
                <Label>Função</Label>
                <div className="px-3 py-2 rounded-md border bg-muted text-sm">
                  {getRoleLabel(profile?.role)}
                </div>
              </div>

              <Button type="submit" disabled={savingProfile} className="w-full">
                {savingProfile ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Dados da Empresa */}
        {company && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Dados da Empresa
              </CardTitle>
              <CardDescription>
                Informações da sua empresa para contratos e documentos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCompanySubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Nome da Empresa</Label>
                  <Input
                    id="company_name"
                    value={companyFormData.name}
                    onChange={(e) => setCompanyFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome da sua empresa"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={companyFormData.cnpj}
                    onChange={handleCNPJChange}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Textarea
                    id="address"
                    value={companyFormData.address}
                    onChange={(e) => setCompanyFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Endereço completo da empresa"
                    rows={3}
                  />
                </div>

                <Button type="submit" disabled={savingCompany} className="w-full">
                  {savingCompany ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Dados da Empresa
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}

export default ProfilePage
