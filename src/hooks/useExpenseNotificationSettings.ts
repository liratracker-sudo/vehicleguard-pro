import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

export interface ExpenseNotificationSettings {
  id: string
  company_id: string
  is_active: boolean
  pre_due_days: number[]
  notify_on_due: boolean
  post_due_days: number[]
  send_hour: string
  template_pre_due: string
  template_on_due: string
  template_post_due: string
  send_daily_summary: boolean
  created_at: string
  updated_at: string
}

export function useExpenseNotificationSettings() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Get current user's company_id
  const { data: profile } = useQuery({
    queryKey: ["profile-for-expense-notifications"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single()

      if (error) throw error
      return data
    }
  })

  const companyId = profile?.company_id

  // Fetch settings
  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ["expense-notification-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null

      const { data, error } = await supabase
        .from("expense_notification_settings")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle()

      if (error) throw error
      return data as ExpenseNotificationSettings | null
    },
    enabled: !!companyId
  })

  // Save settings (insert or update)
  const saveSettings = useMutation({
    mutationFn: async (newSettings: Partial<ExpenseNotificationSettings>) => {
      if (!companyId) throw new Error("Company ID not found")

      if (settings?.id) {
        // Update existing
        const { data, error } = await supabase
          .from("expense_notification_settings")
          .update({
            ...newSettings,
            updated_at: new Date().toISOString()
          })
          .eq("id", settings.id)
          .select()
          .single()

        if (error) throw error
        return data
      } else {
        // Insert new
        const { data, error } = await supabase
          .from("expense_notification_settings")
          .insert({
            company_id: companyId,
            ...newSettings
          })
          .select()
          .single()

        if (error) throw error
        return data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-notification-settings"] })
      toast({
        title: "Configurações salvas",
        description: "As configurações de notificação de despesas foram atualizadas."
      })
    },
    onError: (error) => {
      console.error("Error saving settings:", error)
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive"
      })
    }
  })

  // Fetch notification logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["expense-notification-logs", companyId],
    queryFn: async () => {
      if (!companyId) return []

      const { data, error } = await supabase
        .from("expense_notification_logs")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) throw error
      return data
    },
    enabled: !!companyId
  })

  return {
    settings,
    isLoading,
    saveSettings,
    logs,
    logsLoading,
    refetch,
    companyId
  }
}
