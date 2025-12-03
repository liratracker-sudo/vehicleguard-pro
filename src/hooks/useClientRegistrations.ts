import { useState, useEffect, useRef } from "react"
import { supabase } from "@/integrations/supabase/client"
import { playNotificationSound } from "@/lib/notification-sound"

export const useClientRegistrations = () => {
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const previousCountRef = useRef<number>(0)
  const isFirstLoadRef = useRef<boolean>(true)

  useEffect(() => {
    loadPendingCount()

    // Subscribe to changes in real-time
    const channel = supabase
      .channel('client-registrations-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'client_registrations'
        },
        (payload) => {
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
          table: 'client_registrations'
        },
        () => {
          loadPendingCount()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'client_registrations'
        },
        () => {
          loadPendingCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadPendingCount = async () => {
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

      if (!profile) {
        setLoading(false)
        return
      }

      const { count, error } = await supabase
        .from('client_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('status', 'pending')

      if (error) throw error
      
      const newCount = count || 0
      
      // Tocar som se o contador aumentou (backup caso o INSERT não seja capturado)
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
  }

  return { pendingCount, loading }
}
