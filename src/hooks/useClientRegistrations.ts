import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/integrations/supabase/client"
import { playNotificationSound } from "@/lib/notification-sound"

export const useClientRegistrations = () => {
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const previousCountRef = useRef<number>(0)
  const isFirstLoadRef = useRef<boolean>(true)
  const companyIdRef = useRef<string | null>(null)

  const loadPendingCount = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile?.company_id) {
        setLoading(false)
        return
      }

      // Armazenar company_id para uso no realtime
      companyIdRef.current = profile.company_id

      const { count, error } = await supabase
        .from('client_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('status', 'pending')

      if (error) throw error
      
      const newCount = count || 0
      
      // Tocar som se o contador aumentou (e não é primeira carga)
      if (!isFirstLoadRef.current && newCount > previousCountRef.current) {
        console.log('🔔 Novo cadastro detectado! Anterior:', previousCountRef.current, 'Novo:', newCount)
        playNotificationSound()
      }
      
      previousCountRef.current = newCount
      isFirstLoadRef.current = false
      setPendingCount(newCount)
    } catch (error) {
      console.error('Error loading pending registrations count:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let pollingInterval: NodeJS.Timeout | null = null

    const setupSubscription = async () => {
      // Carregar contagem inicial e obter company_id
      await loadPendingCount()

      const companyId = companyIdRef.current
      if (!companyId) {
        console.log('⚠️ Sem company_id, não configurando realtime')
        return
      }

      console.log('📡 Configurando realtime para company_id:', companyId)

      // Subscribe to changes in real-time com filtro de company_id
      channel = supabase
        .channel('client-registrations-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'client_registrations',
            filter: `company_id=eq.${companyId}`
          },
          (payload) => {
            console.log('🔔 Realtime INSERT recebido:', payload)
            // Novo cadastro detectado - tocar som se for pendente
            if (payload.new && (payload.new as any).status === 'pending') {
              playNotificationSound()
            }
            loadPendingCount()
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'client_registrations',
            filter: `company_id=eq.${companyId}`
          },
          () => {
            console.log('📝 Realtime UPDATE recebido')
            loadPendingCount()
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'client_registrations',
            filter: `company_id=eq.${companyId}`
          },
          () => {
            console.log('🗑️ Realtime DELETE recebido')
            loadPendingCount()
          }
        )
        .subscribe((status) => {
          console.log('📡 Status do canal realtime:', status)
        })

      // Polling de backup a cada 30 segundos
      pollingInterval = setInterval(() => {
        console.log('⏰ Polling de backup executando...')
        loadPendingCount()
      }, 30000)
    }

    setupSubscription()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [loadPendingCount])

  return { pendingCount, loading }
}
