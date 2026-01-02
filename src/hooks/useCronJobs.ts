import { useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface CronJob {
  jobid?: number
  jobname: string
  schedule: string
  command?: string
  active: boolean
  nodename?: string
}

export interface CronJobHistory {
  id: string
  job_name: string
  status: string | null
  started_at: string | null
  finished_at: string | null
  execution_time_ms: number | null
  error_message: string | null
  response_body: string | null
}

// Edge functions conhecidas do sistema
export const KNOWN_FUNCTIONS = [
  { name: 'process-scheduled-reminders', label: 'Lembretes Agendados', description: 'Processa lembretes de pagamento agendados' },
  { name: 'billing-notifications', label: 'Notificações de Cobrança', description: 'Envia notificações de vencimento e atraso' },
  { name: 'auto-escalation', label: 'Escalada de Inadimplência', description: 'Processa escalada automática de clientes inadimplentes' },
  { name: 'generate-charges', label: 'Gerar Cobranças', description: 'Gera cobranças automáticas' },
  { name: 'asaas-sync-payments', label: 'Sincronizar Asaas', description: 'Sincroniza pagamentos com Asaas' },
]

// Expressões cron comuns
export const CRON_PRESETS = [
  { label: 'A cada minuto', value: '* * * * *', description: 'Executa a cada minuto' },
  { label: 'A cada 5 minutos', value: '*/5 * * * *', description: 'Executa a cada 5 minutos' },
  { label: 'A cada 30 minutos', value: '*/30 * * * *', description: 'Executa a cada 30 minutos' },
  { label: 'A cada hora', value: '0 * * * *', description: 'Executa no início de cada hora' },
  { label: 'Diário às 9h (Brasília)', value: '0 12 * * *', description: 'Executa às 9:00 horário de Brasília' },
  { label: 'Diário às 8h-11h (Brasília)', value: '0,30 11,12,13,14 * * *', description: 'Notificações manhã' },
  { label: 'Diário às 14h-16h (Brasília)', value: '0 17,18,19 * * *', description: 'Notificações tarde' },
  { label: 'Semanal (Segunda 9h)', value: '0 12 * * 1', description: 'Segunda-feira às 9h Brasília' },
]

export function useCronJobs() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [history, setHistory] = useState<CronJobHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const { toast } = useToast()

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast({ title: 'Sessão expirada', variant: 'destructive' })
        return
      }

      const { data, error } = await supabase.functions.invoke('cron-management', {
        body: {}
      })

      if (error) {
        console.error('Erro ao buscar jobs:', error)
        toast({ title: 'Erro ao buscar jobs', description: error.message, variant: 'destructive' })
        return
      }

      setJobs(data?.jobs || [])
    } catch (err) {
      console.error('Erro:', err)
      toast({ title: 'Erro ao buscar jobs', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchHistory = useCallback(async (jobName?: string, limit = 50) => {
    setHistoryLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Buscar diretamente da tabela cron_execution_logs
      let query = supabase
        .from('cron_execution_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit)

      if (jobName) {
        query = query.eq('job_name', jobName)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erro ao buscar histórico:', error)
        toast({ title: 'Erro ao buscar histórico', description: error.message, variant: 'destructive' })
        return
      }

      setHistory(data || [])
    } catch (err) {
      console.error('Erro:', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [toast])

  const runJobNow = useCallback(async (functionName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast({ title: 'Sessão expirada', variant: 'destructive' })
        return false
      }

      toast({ title: 'Executando...', description: `Iniciando ${functionName}` })

      const { data, error } = await supabase.functions.invoke('cron-management/run', {
        body: { functionName }
      })

      if (error) {
        console.error('Erro ao executar:', error)
        toast({ title: 'Erro ao executar', description: error.message, variant: 'destructive' })
        return false
      }

      toast({ title: 'Sucesso!', description: `${functionName} executado com sucesso` })
      
      // Aguardar um pouco e atualizar histórico
      setTimeout(() => fetchHistory(), 2000)
      
      return true
    } catch (err) {
      console.error('Erro:', err)
      toast({ title: 'Erro ao executar', variant: 'destructive' })
      return false
    }
  }, [toast, fetchHistory])

  const createJob = useCallback(async (jobName: string, functionName: string, schedule: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast({ title: 'Sessão expirada', variant: 'destructive' })
        return false
      }

      const { data, error } = await supabase.functions.invoke('cron-management', {
        body: { jobName, functionName, schedule }
      })

      if (error) {
        console.error('Erro ao criar job:', error)
        toast({ title: 'Erro ao criar job', description: error.message, variant: 'destructive' })
        return false
      }

      toast({ title: 'Job criado!', description: `${jobName} agendado com sucesso` })
      fetchJobs()
      return true
    } catch (err) {
      console.error('Erro:', err)
      toast({ title: 'Erro ao criar job', variant: 'destructive' })
      return false
    }
  }, [toast, fetchJobs])

  const deleteJob = useCallback(async (jobName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast({ title: 'Sessão expirada', variant: 'destructive' })
        return false
      }

      const response = await fetch(
        `https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/cron-management`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ jobName })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        toast({ title: 'Erro ao remover job', description: data.error, variant: 'destructive' })
        return false
      }

      toast({ title: 'Job removido!', description: `${jobName} foi removido` })
      fetchJobs()
      return true
    } catch (err) {
      console.error('Erro:', err)
      toast({ title: 'Erro ao remover job', variant: 'destructive' })
      return false
    }
  }, [toast, fetchJobs])

  return {
    jobs,
    history,
    loading,
    historyLoading,
    fetchJobs,
    fetchHistory,
    runJobNow,
    createJob,
    deleteJob,
    KNOWN_FUNCTIONS,
    CRON_PRESETS
  }
}
