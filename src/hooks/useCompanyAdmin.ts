import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface CompanyStats {
  totalCompanies: number
  activeCompanies: number
  totalRevenue: number
  totalUsers: number
  recentActivity: Array<{
    id: string
    company_name: string
    activity_type: string
    description: string
    created_at: string
  }>
}

export function useCompanyAdmin() {
  const { toast } = useToast()
  const [stats, setStats] = useState<CompanyStats>({
    totalCompanies: 0,
    activeCompanies: 0,
    totalRevenue: 0,
    totalUsers: 0,
    recentActivity: []
  })
  const [loading, setLoading] = useState(true)

  const loadStats = async () => {
    try {
      // Carregar estatísticas das empresas
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('is_active')

      if (companiesError) throw companiesError

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

      // Carregar total de usuários
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id')

      if (profilesError) throw profilesError

      setStats({
        totalCompanies: companies?.length || 0,
        activeCompanies: companies?.filter(c => c.is_active)?.length || 0,
        totalRevenue: 0, // TODO: Implementar cálculo de receita
        totalUsers: profiles?.length || 0,
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
      // RPC log_company_activity não existe após restauração - inserir diretamente
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

  useEffect(() => {
    loadStats()

    // Realtime subscription para atividades
    const channel = supabase
      .channel('admin-stats')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'companies' },
        () => loadStats()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'company_activity_logs' },
        () => loadStats()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return {
    stats,
    loading,
    loadStats,
    logActivity
  }
}