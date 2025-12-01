import { useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

export const useFixAddresses = () => {
  const [fixing, setFixing] = useState(false)

  const fixAddresses = async () => {
    setFixing(true)
    try {
      const { data, error } = await supabase.functions.invoke('fix-imported-addresses')

      if (error) throw error

      const result = data as { fixedCount: number; totalClients: number; errors?: string[] }

      if (result.errors && result.errors.length > 0) {
        toast.warning(`${result.fixedCount} endereços corrigidos com ${result.errors.length} erros`, {
          description: `Total de clientes: ${result.totalClients}`
        })
      } else {
        toast.success(`${result.fixedCount} endereços corrigidos com sucesso!`, {
          description: `Total de clientes: ${result.totalClients}`
        })
      }

      return { success: true, ...result }
    } catch (error) {
      console.error('Erro ao corrigir endereços:', error)
      toast.error('Erro ao corrigir endereços', {
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
      return { success: false }
    } finally {
      setFixing(false)
    }
  }

  return {
    fixing,
    fixAddresses
  }
}
