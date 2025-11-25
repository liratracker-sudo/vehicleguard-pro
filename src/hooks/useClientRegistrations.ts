import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"

export const useClientRegistrations = () => {
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPendingCount()

    // Subscribe to changes in real-time
    const channel = supabase
      .channel('client-registrations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
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
      
      setPendingCount(count || 0)
    } catch (error) {
      console.error('Error loading pending registrations count:', error)
    } finally {
      setLoading(false)
    }
  }

  return { pendingCount, loading }
}