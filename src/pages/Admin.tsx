import { AppLayout } from "@/components/layout/AppLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateBR } from "@/lib/timezone"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCompanyAdmin } from "@/hooks/useCompanyAdmin"
import { CompanyManagement } from "@/components/admin/CompanyManagement"
import { SubscriptionPlansManagement } from "@/components/admin/SubscriptionPlansManagement"
import { ReengagementManagement } from "@/components/admin/ReengagementManagement"
import { Building2, Crown, TrendingUp, CreditCard, FileText, Users, Mail } from "lucide-react"

const AdminPage = () => {
  const { stats, loading: statsLoading } = useCompanyAdmin()

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-8 h-8 text-primary" />
              Administração SaaS
            </h1>
            <p className="text-muted-foreground">
              Gerencie empresas, planos e configurações do sistema
            </p>
          </div>
          <Badge variant="outline" className="gap-2">
            <Crown className="w-4 h-4" />
            Super Admin
          </Badge>
        </div>

        <Tabs defaultValue="stats" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="stats" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Estatísticas
            </TabsTrigger>
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="w-4 h-4" />
              Empresas
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Planos
            </TabsTrigger>
            <TabsTrigger value="reengagement" className="gap-2">
              <Mail className="w-4 h-4" />
              Reengajamento
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <FileText className="w-4 h-4" />
              Atividades
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Empresas</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? '--' : stats.totalCompanies}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {statsLoading ? '' : `${stats.activeCompanies} ligadas`}
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Usando Ativamente</CardTitle>
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-400">
                    {statsLoading ? '--' : stats.activelyUsing}
                  </div>
                  <p className="text-xs text-muted-foreground">Atividade nos últimos 7 dias</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Empresas Vazias</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-muted-foreground">
                    {statsLoading ? '--' : stats.emptyCompanies}
                  </div>
                  <p className="text-xs text-muted-foreground">Nunca cadastraram dados</p>
                </CardContent>
              </Card>
              
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
                  <CreditCard className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {statsLoading ? 'R$ --' : stats.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {statsLoading ? '' : `${stats.activePlansCount} plano${stats.activePlansCount !== 1 ? 's' : ''} ativo${stats.activePlansCount !== 1 ? 's' : ''}`}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Atividades Recentes */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Atividades Recentes</CardTitle>
                <CardDescription>
                  Últimas ações realizadas no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats.recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{activity.company_name}</p>
                          <p className="text-sm text-muted-foreground">{activity.description}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{activity.activity_type}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDateBR(activity.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {stats.recentActivity.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhuma atividade recente
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="companies">
            <CompanyManagement />
          </TabsContent>

          <TabsContent value="plans">
            <SubscriptionPlansManagement />
          </TabsContent>

          <TabsContent value="reengagement">
            <ReengagementManagement />
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Log de Atividades</CardTitle>
                <CardDescription>
                  Monitore atividades de todas as empresas do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Em desenvolvimento...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

export default AdminPage