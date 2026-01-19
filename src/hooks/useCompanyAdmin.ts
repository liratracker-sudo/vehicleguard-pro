import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

export interface CompanyMetrics {
  id: string
  name: string
  slug: string
  email: string | null
  phone: string | null
  domain: string | null
  is_active: boolean
  created_at: string
  // Métricas de uso
  total_clients: number
  total_vehicles: number
  total_payments: number
  total_users: number
  // Datas de atividade
  last_client_created: string | null
  last_payment_created: string | null
  last_activity: string | null
  // Subscription
  subscription_status: string | null
  plan_name: string | null
  plan_price: number | null
  // Saúde calculada
  health_score: number
  activity_status: 'active' | 'idle' | 'abandoned' | 'empty'
}

interface CompanyStats {
  totalCompanies: number
  activeCompanies: number
  activelyUsing: number
  emptyCompanies: number
  idleCompanies: number
  abandonedCompanies: number
  totalRevenue: number
  activePlansCount: number
  totalUsers: number
  recentActivity: Array<{
    id: string
    company_name: string
    activity_type: string
    description: string
    created_at: string
  }>
}

type ActivityFilter = 'all' | 'active' | 'idle' | 'abandoned' | 'empty'
type PlanFilter = 'all' | 'with_plan' | 'without_plan'

export function useCompanyAdmin() {
  const { toast } = useToast()
  const [companies, setCompanies] = useState<CompanyMetrics[]>([])
  const [stats, setStats] = useState<CompanyStats>({
    totalCompanies: 0,
    activeCompanies: 0,
    activelyUsing: 0,
    emptyCompanies: 0,
    idleCompanies: 0,
    abandonedCompanies: 0,
    totalRevenue: 0,
    activePlansCount: 0,
    totalUsers: 0,
    recentActivity: []
  })
  const [loading, setLoading] = useState(true)
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all')

  const calculateHealthScore = (company: {
    total_clients: number
    total_vehicles: number
    total_payments: number
    last_activity: string | null
  }): number => {
    let score = 0
    if (company.total_clients > 0) score += 25
    if (company.total_vehicles > 0) score += 25
    if (company.total_payments > 0) score += 25
    
    // Atividade recente (últimos 7 dias)
    if (company.last_activity) {
      const daysSinceActivity = Math.floor(
        (Date.now() - new Date(company.last_activity).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysSinceActivity <= 7) score += 25
    }
    
    return score
  }

  const calculateActivityStatus = (company: {
    total_clients: number
    total_vehicles: number
    total_payments: number
    last_activity: string | null
  }): 'active' | 'idle' | 'abandoned' | 'empty' => {
    // Empresa vazia - nunca cadastrou dados
    if (company.total_clients === 0 && company.total_vehicles === 0 && company.total_payments === 0) {
      return 'empty'
    }

    if (!company.last_activity) {
      return 'abandoned'
    }

    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(company.last_activity).getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysSinceActivity <= 7) return 'active'
    if (daysSinceActivity <= 30) return 'idle'
    return 'abandoned'
  }

  const loadCompaniesWithMetrics = async () => {
    try {
      // Buscar empresas com métricas agregadas usando queries separadas
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false })

      if (companiesError) throw companiesError

      // Buscar contagens para cada empresa
      const companiesWithMetrics: CompanyMetrics[] = await Promise.all(
        (companiesData || []).map(async (company) => {
          // Buscar métricas em paralelo
          const [
            clientsResult,
            vehiclesResult,
            paymentsResult,
            usersResult,
            subscriptionResult
          ] = await Promise.all([
            supabase
              .from('clients')
              .select('id, created_at')
              .eq('company_id', company.id)
              .order('created_at', { ascending: false })
              .limit(1),
            supabase
              .from('vehicles')
              .select('id')
              .eq('company_id', company.id),
            supabase
              .from('payment_transactions')
              .select('id, created_at')
              .eq('company_id', company.id)
              .order('created_at', { ascending: false })
              .limit(1),
            supabase
              .from('profiles')
              .select('id')
              .eq('company_id', company.id),
            supabase
              .from('company_subscriptions')
              .select(`
                status,
                subscription_plans (
                  name,
                  price_monthly
                )
              `)
              .eq('company_id', company.id)
              .eq('status', 'active')
              .limit(1)
              .maybeSingle()
          ])

          // Contar totais
          const [clientsCount, vehiclesCount, paymentsCount] = await Promise.all([
            supabase.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
            supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
            supabase.from('payment_transactions').select('id', { count: 'exact', head: true }).eq('company_id', company.id)
          ])

          const total_clients = clientsCount.count || 0
          const total_vehicles = vehiclesCount.count || 0
          const total_payments = paymentsCount.count || 0
          const total_users = usersResult.data?.length || 0

          const last_client_created = clientsResult.data?.[0]?.created_at || null
          const last_payment_created = paymentsResult.data?.[0]?.created_at || null

          // Determinar última atividade
          const dates = [last_client_created, last_payment_created].filter(Boolean) as string[]
          const last_activity = dates.length > 0 
            ? dates.reduce((a, b) => new Date(a) > new Date(b) ? a : b)
            : null

          const subscription = subscriptionResult.data
          const plan = subscription?.subscription_plans as { name: string; price_monthly: number } | null

          const metrics = {
            total_clients,
            total_vehicles,
            total_payments,
            last_activity
          }

          return {
            id: company.id,
            name: company.name,
            slug: company.slug,
            email: company.email,
            phone: company.phone,
            domain: company.domain,
            is_active: company.is_active,
            created_at: company.created_at,
            total_clients,
            total_vehicles,
            total_payments,
            total_users,
            last_client_created,
            last_payment_created,
            last_activity,
            subscription_status: subscription?.status || null,
            plan_name: plan?.name || null,
            plan_price: plan?.price_monthly || null,
            health_score: calculateHealthScore(metrics),
            activity_status: calculateActivityStatus(metrics)
          }
        })
      )

      setCompanies(companiesWithMetrics)

      // Calcular estatísticas
      const activelyUsing = companiesWithMetrics.filter(c => c.activity_status === 'active').length
      const emptyCompanies = companiesWithMetrics.filter(c => c.activity_status === 'empty').length
      const idleCompanies = companiesWithMetrics.filter(c => c.activity_status === 'idle').length
      const abandonedCompanies = companiesWithMetrics.filter(c => c.activity_status === 'abandoned').length
      
      const totalRevenue = companiesWithMetrics
        .filter(c => c.subscription_status === 'active' && c.plan_price)
        .reduce((sum, c) => sum + (c.plan_price || 0), 0)
      
      const activePlansCount = companiesWithMetrics
        .filter(c => c.subscription_status === 'active').length

      // Carregar atividades recentes
      const { data: activities, error: activitiesError } = await supabase
        .from('company_activity_logs')
        .select(`
          id,
          activity_type,
          description,
          created_at,
          companies!inner(name)
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      if (activitiesError) throw activitiesError

      setStats({
        totalCompanies: companiesWithMetrics.length,
        activeCompanies: companiesWithMetrics.filter(c => c.is_active).length,
        activelyUsing,
        emptyCompanies,
        idleCompanies,
        abandonedCompanies,
        totalRevenue,
        activePlansCount,
        totalUsers: companiesWithMetrics.reduce((sum, c) => sum + c.total_users, 0),
        recentActivity: activities?.map(activity => ({
          id: activity.id,
          company_name: (activity.companies as any)?.name || 'Empresa não identificada',
          activity_type: activity.activity_type,
          description: activity.description,
          created_at: activity.created_at
        })) || []
      })
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

  const logActivity = async (companyId: string, activityType: string, description: string, metadata: any = {}) => {
    try {
      const { error } = await supabase
        .from('company_activity_logs')
        .insert({
          company_id: companyId,
          activity_type: activityType,
          description: description,
          metadata: metadata
        })

      if (error) throw error
    } catch (error: any) {
      console.error('Erro ao registrar atividade:', error)
    }
  }

  // Filtrar empresas
  const filteredCompanies = companies.filter(company => {
    // Filtro de atividade
    if (activityFilter !== 'all' && company.activity_status !== activityFilter) {
      return false
    }

    // Filtro de plano
    if (planFilter === 'with_plan' && !company.subscription_status) {
      return false
    }
    if (planFilter === 'without_plan' && company.subscription_status) {
      return false
    }

    return true
  })

  useEffect(() => {
    loadCompaniesWithMetrics()

    // Realtime subscription para atividades
    const channel = supabase
      .channel('admin-stats')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'companies' },
        () => loadCompaniesWithMetrics()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'company_activity_logs' },
        () => loadCompaniesWithMetrics()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return {
    companies: filteredCompanies,
    allCompanies: companies,
    stats,
    loading,
    loadStats: loadCompaniesWithMetrics,
    logActivity,
    activityFilter,
    setActivityFilter,
    planFilter,
    setPlanFilter
  }
}
