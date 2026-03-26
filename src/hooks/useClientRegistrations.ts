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
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile?.company_id) { setLoading(false); return }

      companyIdRef.current = profile.company_id

      const { count, error } = await supabase
        .from('client_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('status', 'pending')

      if (error) throw error
      
      const newCount = count || 0
      
      if (!isFirstLoadRef.current && newCount > previousCountRef.current) {
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
    // Delay initial load to not block sidebar render
    const initialTimer = setTimeout(() => {
      const setup = async () => {
        await loadPendingCount()
        const companyId = companyIdRef.current
        if (!companyId) return

        channel = supabase
          .channel('client-registrations-changes')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'client_registrations', filter: `company_id=eq.${companyId}` },
            (payload) => {
              if (payload.new && (payload.new as any).status === 'pending') playNotificationSound()
              loadPendingCount()
            }
          )
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'client_registrations', filter: `company_id=eq.${companyId}` },
            () => loadPendingCount()
          )
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'client_registrations', filter: `company_id=eq.${companyId}` },
            () => loadPendingCount()
          )
          .subscribe()
      }
      setup()
    }, 3000) // Delay 3s to let sidebar render first

    return () => {
      clearTimeout(initialTimer)
      if (channel) supabase.removeChannel(channel)
    }
  }, [loadPendingCount])

  return { pendingCount, loading }
}
