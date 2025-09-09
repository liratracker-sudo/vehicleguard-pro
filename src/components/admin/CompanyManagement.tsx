import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { WhiteLabelConfig } from "./WhiteLabelConfig"
import { CompanyForm } from "./CompanyForm"
import { CompanyLimitsDialog } from "./CompanyLimitsDialog"
import { CompanySubscriptionDialog } from "./CompanySubscriptionDialog"
import { CompanyPasswordDialog } from "./CompanyPasswordDialog"
import { CompanyUsersDialog } from "./CompanyUsersDialog"
import { Building2, Plus, Settings, Activity, Palette, ExternalLink, Edit, CreditCard, Key, Trash2, Users } from "lucide-react"

interface Company {
  id: string
  name: string
  slug: string
  email: string
  phone: string
  domain: string
  is_active: boolean
  created_at: string
  branding?: {
    logo_url: string
    primary_color: string
    subdomain: string
  }
  subscription?: {
    plan_name: string
    status: string
  }
  limits?: {
    max_vehicles: number
    max_users: number
    is_active: boolean
  }
}

export function CompanyManagement() {
  const { toast } = useToast()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [showWhiteLabelConfig, setShowWhiteLabelConfig] = useState(false)
  const [showLimitsDialog, setShowLimitsDialog] = useState(false)
  const [showCompanyForm, setShowCompanyForm] = useState(false)
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [showUsersDialog, setShowUsersDialog] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [companyHasPassword, setCompanyHasPassword] = useState(false)

  const loadCompanies = async () => {
    try {
      const { data: companiesData, error } = await supabase
        .from('companies')
        .select(`
          *,
          company_branding (
            logo_url,
            primary_color,
            subdomain
          ),
          company_subscriptions (
            subscription_plans (
              name
            ),
            status
          ),
          company_limits (
            max_vehicles,
            max_users,
            is_active
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedData = companiesData?.map(company => ({
        ...company,
        branding: company.company_branding?.[0] || null,
        subscription: company.company_subscriptions?.[0] ? {
          plan_name: company.company_subscriptions[0].subscription_plans?.name || 'Sem plano',
          status: company.company_subscriptions[0].status
        } : null,
        limits: company.company_limits?.[0] || null
      })) || []

      setCompanies(formattedData)
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

  const toggleCompanyStatus = async (companyId: string, newStatus: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Não autenticado')

      // Use the edge function for immediate effect
      const response = await supabase.functions.invoke('admin-company-management', {
        body: {
          company_id: companyId,
          is_active: newStatus,
          action: 'toggle_company_status'
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (response.error) throw response.error

      await loadCompanies()
      
      toast({
        title: "Sucesso",
        description: `Empresa ${newStatus ? 'ativada' : 'desativada'} com sucesso e efeito imediato`
      })
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  const openBrandingSettings = (company: Company) => {
    setSelectedCompany(company)
    setShowWhiteLabelConfig(true)
  }

  const openLimitsSettings = (company: Company) => {
    setSelectedCompany(company)
    setShowLimitsDialog(true)
  }

  const handleNewCompany = () => {
    setEditingCompany(null)
    setShowCompanyForm(true)
  }

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company)
    setShowCompanyForm(true)
  }

  const openSubscriptionSettings = (company: Company) => {
    setSelectedCompany(company)
    setShowSubscriptionDialog(true)
  }

  const assignPlanToCompany = async (companyId: string, planId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Não autenticado')

      const response = await supabase.functions.invoke('admin-company-management', {
        body: {
          action: 'assign_plan',
          company_id: companyId,
          plan_id: planId
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (response.error) throw response.error

      toast({
        title: "Sucesso",
        description: "Plano associado com sucesso! Mudanças ativas imediatamente."
      })

      await loadCompanies()
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  const openPasswordSettings = async (company: Company) => {
    setSelectedCompany(company)
    
    // Verificar se a empresa já tem senha
    try {
      const { data, error } = await supabase
        .from('company_credentials')
        .select('id')
        .eq('company_id', company.id)
        .single()

      setCompanyHasPassword(!!data && !error)
    } catch (error) {
      setCompanyHasPassword(false)
    }
    
    setShowPasswordDialog(true)
  }

  const openUsersSettings = (company: Company) => {
    setSelectedCompany(company)
    setShowUsersDialog(true)
  }

  const deleteCompany = async (company: Company) => {
    if (!confirm(`Tem certeza que deseja excluir a empresa "${company.name}"? Esta ação não pode ser desfeita.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', company.id)

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Empresa excluída com sucesso"
      })

      await loadCompanies()
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    loadCompanies()

    // Realtime subscription
    const channel = supabase
      .channel('company-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'companies' },
        () => loadCompanies()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'company_branding' },
        () => loadCompanies()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'company_limits' },
        () => loadCompanies()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gestão de Empresas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Se está mostrando configuração white-label, renderizar apenas ela
  if (showWhiteLabelConfig && selectedCompany) {
    return (
      <WhiteLabelConfig
        companyId={selectedCompany.id}
        companyName={selectedCompany.name}
        onClose={() => {
          setShowWhiteLabelConfig(false)
          setSelectedCompany(null)
          loadCompanies() // Recarregar dados após fechar
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Gestão de Empresas
              </CardTitle>
              <CardDescription>
                Gerencie todas as empresas cadastradas no sistema
              </CardDescription>
            </div>
            <Button className="gap-2" onClick={handleNewCompany}>
              <Plus className="w-4 h-4" />
              Nova Empresa
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Subdomínio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{company.name}</div>
                        <div className="text-sm text-muted-foreground">{company.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {company.subscription ? (
                          <Badge variant={company.subscription.status === 'active' ? 'default' : 'secondary'}>
                            {company.subscription.plan_name}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Sem plano</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openSubscriptionSettings(company)}
                          className="h-6 w-6 p-0"
                        >
                          <CreditCard className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {company.branding?.subdomain ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{company.branding.subdomain}</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Não configurado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={company.is_active}
                          onCheckedChange={(checked) => toggleCompanyStatus(company.id, checked)}
                        />
                        <span className="text-sm">
                          {company.is_active ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(company.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditCompany(company)}
                          className="gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openBrandingSettings(company)}
                          className="gap-2"
                        >
                          <Palette className="w-4 h-4" />
                          Branding
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openLimitsSettings(company)}
                          className="gap-2"
                        >
                          <Settings className="w-4 h-4" />
                          Limites
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openUsersSettings(company)}
                          className="gap-2"
                        >
                          <Users className="w-4 h-4" />
                          Usuários
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPasswordSettings(company)}
                          className="gap-2"
                        >
                          <Key className="w-4 h-4" />
                          Senha
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteCompany(company)}
                          className="gap-2 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {companies.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  Nenhuma empresa cadastrada
                </h3>
                <p className="text-sm text-muted-foreground">
                  As empresas aparecerão aqui quando se cadastrarem no sistema
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Company Form Dialog */}
      <CompanyForm
        open={showCompanyForm}
        onOpenChange={setShowCompanyForm}
        company={editingCompany}
        onSaved={loadCompanies}
      />

      {/* Company Limits Dialog */}
      <CompanyLimitsDialog
        open={showLimitsDialog}
        onOpenChange={setShowLimitsDialog}
        companyId={selectedCompany?.id || null}
        companyName={selectedCompany?.name || ''}
        currentLimits={selectedCompany?.limits}
        onSaved={loadCompanies}
      />

      {/* Company Subscription Dialog */}
      <CompanySubscriptionDialog
        open={showSubscriptionDialog}
        onOpenChange={setShowSubscriptionDialog}
        companyId={selectedCompany?.id || null}
        companyName={selectedCompany?.name || ''}
        currentSubscription={selectedCompany?.subscription}
        onSaved={loadCompanies}
      />

      {/* Company Password Dialog */}
      <CompanyPasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        companyId={selectedCompany?.id || null}
        companyName={selectedCompany?.name || ''}
        hasPassword={companyHasPassword}
      />

      {/* Company Users Dialog */}
      <CompanyUsersDialog
        open={showUsersDialog}
        onOpenChange={setShowUsersDialog}
        companyId={selectedCompany?.id || null}
        companyName={selectedCompany?.name || ''}
      />
    </div>
  )
}