import { ReactNode, useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"

interface RoleGuardProps {
  allowed: Array<'super_admin' | 'admin' | 'user' | string>
  children: ReactNode
}

export function RoleGuard({ allowed, children }: RoleGuardProps) {
  const [loading, setLoading] = useState(true)
  const [allowedAccess, setAllowedAccess] = useState(false)

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        if (isMounted) setAllowedAccess(false)
        setLoading(false)
        return
      }
      const userId = session.user.id
      
      // Se está verificando super_admin, buscar de user_roles
      if (allowed.includes('super_admin')) {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'super_admin')
          .single()
        
        if (isMounted) setAllowedAccess(!!userRole)
      } else {
        // Para outros roles, buscar de profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', userId)
          .single()
        const role = profile?.role ?? 'user'
        if (isMounted) setAllowedAccess(allowed.includes(role))
      }
      setLoading(false)
    })()
    return () => { isMounted = false }
  }, [allowed])

  if (loading) return null
  if (!allowedAccess) return <Navigate to="/" replace />
  return <>{children}</>
}
