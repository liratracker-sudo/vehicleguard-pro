import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { CompanyForm } from "./CompanyForm"
import { CompanyLimitsDialog } from "./CompanyLimitsDialog"
import { CompanySubscriptionDialog } from "./CompanySubscriptionDialog"
import { CompanyPasswordDialog } from "./CompanyPasswordDialog"
import { CompanyUsersDialog } from "./CompanyUsersDialog"
import { useCompanyAdmin, type CompanyMetrics } from "@/hooks/useCompanyAdmin"
import { 
  Building2, Plus, Settings, Edit, CreditCard, Key, Trash2, Users, MoreHorizontal, Globe,
  UserCheck, Car, Receipt, Activity, TrendingUp, AlertCircle, Clock, Ghost
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function CompanyManagement() {
  const { toast } = useToast()
  const { 
    companies, 
    stats, 
    loading, 
    loadStats,
    activityFilter,
    setActivityFilter,
    planFilter,
    setPlanFilter
  } = useCompanyAdmin()
  
  const [selectedCompany, setSelectedCompany] = useState<CompanyMetrics | null>(null)
  const [showLimitsDialog, setShowLimitsDialog] = useState(false)
  const [showCompanyForm, setShowCompanyForm] = useState(false)
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [showUsersDialog, setShowUsersDialog] = useState(false)
  const [editingCompany, setEditingCompany] = useState<CompanyMetrics | null>(null)
  const [companyHasPassword, setCompanyHasPassword] = useState(false)

  const toggleCompanyStatus = async (companyId: string, newStatus: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Não autenticado')

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

      await loadStats()
      
      toast({
        title: "Sucesso",
        description: `Empresa ${newStatus ? 'ativada' : 'desativada'} com sucesso`
      })
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  const openLimitsSettings = (company: CompanyMetrics) => {
    setSelectedCompany(company)
    setShowLimitsDialog(true)
  }

  const handleNewCompany = () => {
    setEditingCompany(null)
    setShowCompanyForm(true)
  }

  const handleEditCompany = (company: CompanyMetrics) => {
    setEditingCompany(company)
    setShowCompanyForm(true)
  }

  const openSubscriptionSettings = (company: CompanyMetrics) => {
    setSelectedCompany(company)
    setShowSubscriptionDialog(true)
  }

  const openPasswordSettings = async (company: CompanyMetrics) => {
    setSelectedCompany(company)
    
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

  const openUsersSettings = (company: CompanyMetrics) => {
    setSelectedCompany(company)
    setShowUsersDialog(true)
  }

  const deleteCompany = async (company: CompanyMetrics, forceDelete = false) => {
    if (!forceDelete && !confirm(`Tem certeza que deseja excluir a empresa "${company.name}"? Esta ação não pode ser desfeita.`)) {
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Não autenticado')

      const { data, error } = await supabase.functions.invoke('admin-company-management', {
        body: {
          action: 'delete_company',
          company_id: company.id,
          force_delete: forceDelete
        }
      })

      if (error) throw error

      // Check if company has linked data
      if (data?.error === 'has_linked_data') {
        const proceed = confirm(
          `Esta empresa possui dados vinculados:\n` +
          `- ${data.data.clients} clientes\n` +
          `- ${data.data.vehicles} veículos\n` +
          `- ${data.data.payments} cobranças\n\n` +
          `Deseja excluir TODOS os dados permanentemente?`
        )
        
        if (proceed) {
          // Retry with force_delete
          await deleteCompany(company, true)
        }
        return
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      toast({
        title: "Sucesso",
        description: "Empresa excluída com sucesso"
      })

      await loadStats()
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  const getActivityStatusBadge = (status: CompanyMetrics['activity_status']) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
            <Activity className="w-3 h-3" />
            Ativa
          </Badge>
        )
      case 'idle':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">
            <Clock className="w-3 h-3" />
            Ociosa
          </Badge>
        )
      case 'abandoned':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
            <AlertCircle className="w-3 h-3" />
            Abandonada
          </Badge>
        )
      case 'empty':
        return (
          <Badge className="bg-muted text-muted-foreground border-border gap-1">
            <Ghost className="w-3 h-3" />
            Vazia
          </Badge>
        )
    }
  }

  const getHealthScoreColor = (score: number) => {
    if (score >= 75) return 'bg-emerald-500'
    if (score >= 50) return 'bg-yellow-500'
    if (score >= 25) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const formatLastActivity = (date: string | null) => {
    if (!date) return 'Nunca'
    
    const now = new Date()
    const activityDate = new Date(date)
    const diffDays = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Hoje'
    if (diffDays === 1) return 'Ontem'
    if (diffDays < 7) return `${diffDays} dias`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} sem.`
    return `${Math.floor(diffDays / 30)} mês${Math.floor(diffDays / 30) > 1 ? 'es' : ''}`
  }

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

  return (
    <div className="space-y-6">
      {/* Cards de estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Empresas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCompanies}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeCompanies} ligadas • {stats.totalCompanies - stats.activeCompanies} desligadas
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usando Ativamente</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{stats.activelyUsing}</div>
            <p className="text-xs text-muted-foreground">
              Atividade nos últimos 7 dias
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas Vazias</CardTitle>
            <Ghost className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats.emptyCompanies}</div>
            <p className="text-xs text-muted-foreground">
              Nunca cadastraram dados
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {stats.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.activePlansCount} plano{stats.activePlansCount !== 1 ? 's' : ''} ativo{stats.activePlansCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
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

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 pt-4">
            <div className="flex items-center gap-1 text-sm text-muted-foreground mr-2">
              Atividade:
            </div>
            <Button
              variant={activityFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActivityFilter('all')}
            >
              Todas ({stats.totalCompanies})
            </Button>
            <Button
              variant={activityFilter === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActivityFilter('active')}
              className={activityFilter === 'active' ? '' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}
            >
              <Activity className="w-3 h-3 mr-1" />
              Ativas ({stats.activelyUsing})
            </Button>
            <Button
              variant={activityFilter === 'idle' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActivityFilter('idle')}
              className={activityFilter === 'idle' ? '' : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'}
            >
              <Clock className="w-3 h-3 mr-1" />
              Ociosas ({stats.idleCompanies})
            </Button>
            <Button
              variant={activityFilter === 'abandoned' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActivityFilter('abandoned')}
              className={activityFilter === 'abandoned' ? '' : 'border-red-500/30 text-red-400 hover:bg-red-500/10'}
            >
              <AlertCircle className="w-3 h-3 mr-1" />
              Abandonadas ({stats.abandonedCompanies})
            </Button>
            <Button
              variant={activityFilter === 'empty' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActivityFilter('empty')}
            >
              <Ghost className="w-3 h-3 mr-1" />
              Vazias ({stats.emptyCompanies})
            </Button>

            <div className="w-px h-6 bg-border mx-2" />

            <div className="flex items-center gap-1 text-sm text-muted-foreground mr-2">
              Plano:
            </div>
            <Button
              variant={planFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPlanFilter('all')}
            >
              Todos
            </Button>
            <Button
              variant={planFilter === 'with_plan' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPlanFilter('with_plan')}
            >
              Com plano
            </Button>
            <Button
              variant={planFilter === 'without_plan' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPlanFilter('without_plan')}
            >
              Sem plano
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 justify-center">
                          <UserCheck className="w-4 h-4" />
                        </TooltipTrigger>
                        <TooltipContent>Clientes</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 justify-center">
                          <Car className="w-4 h-4" />
                        </TooltipTrigger>
                        <TooltipContent>Veículos</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 justify-center">
                          <Receipt className="w-4 h-4" />
                        </TooltipTrigger>
                        <TooltipContent>Cobranças</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead>Última Atividade</TableHead>
                  <TableHead>Saúde</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Ativa</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{company.name}</div>
                        <div className="text-xs text-muted-foreground">{company.email || '-'}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={company.total_clients > 0 ? 'font-medium' : 'text-muted-foreground'}>
                        {company.total_clients}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={company.total_vehicles > 0 ? 'font-medium' : 'text-muted-foreground'}>
                        {company.total_vehicles}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={company.total_payments > 0 ? 'font-medium' : 'text-muted-foreground'}>
                        {company.total_payments}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={company.last_activity ? '' : 'text-muted-foreground'}>
                        {formatLastActivity(company.last_activity)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={company.health_score} 
                                className="h-2 w-16"
                                indicatorClassName={getHealthScoreColor(company.health_score)}
                              />
                              <span className="text-xs text-muted-foreground w-8">
                                {company.health_score}%
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">
                              <p>Clientes: {company.total_clients > 0 ? '✓' : '✗'} (+25%)</p>
                              <p>Veículos: {company.total_vehicles > 0 ? '✓' : '✗'} (+25%)</p>
                              <p>Cobranças: {company.total_payments > 0 ? '✓' : '✗'} (+25%)</p>
                              <p>Atividade recente: {company.activity_status === 'active' ? '✓' : '✗'} (+25%)</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      {getActivityStatusBadge(company.activity_status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {company.plan_name ? (
                          <Badge variant={company.subscription_status === 'active' ? 'default' : 'secondary'}>
                            {company.plan_name}
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
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={company.is_active}
                          onCheckedChange={(checked) => toggleCompanyStatus(company.id, checked)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => handleEditCompany(company)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openLimitsSettings(company)}>
                            <Settings className="w-4 h-4 mr-2" />
                            Limites
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openUsersSettings(company)}>
                            <Users className="w-4 h-4 mr-2" />
                            Usuários
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openPasswordSettings(company)}>
                            <Key className="w-4 h-4 mr-2" />
                            Senha
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => deleteCompany(company)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {companies.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  Nenhuma empresa encontrada
                </h3>
                <p className="text-sm text-muted-foreground">
                  {activityFilter !== 'all' || planFilter !== 'all' 
                    ? 'Tente ajustar os filtros' 
                    : 'As empresas aparecerão aqui quando se cadastrarem no sistema'
                  }
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
        onSaved={loadStats}
      />

      {/* Company Limits Dialog */}
      <CompanyLimitsDialog
        open={showLimitsDialog}
        onOpenChange={setShowLimitsDialog}
        companyId={selectedCompany?.id || null}
        companyName={selectedCompany?.name || ''}
        currentLimits={undefined}
        onSaved={loadStats}
      />

      {/* Company Subscription Dialog */}
      <CompanySubscriptionDialog
        open={showSubscriptionDialog}
        onOpenChange={setShowSubscriptionDialog}
        companyId={selectedCompany?.id || null}
        companyName={selectedCompany?.name || ''}
        currentSubscription={selectedCompany ? {
          plan_name: selectedCompany.plan_name || 'Sem plano',
          status: selectedCompany.subscription_status || 'inactive'
        } : undefined}
        onSaved={loadStats}
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
