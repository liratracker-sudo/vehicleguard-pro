import { useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

interface ImportSummary {
  total_asaas: number
  imported: number
  duplicates: number
  errors: number
}

interface ImportResult {
  success: boolean
  summary?: ImportSummary
  imported_clients?: string[]
  duplicate_clients?: string[]
  error_details?: Array<{ name: string; error: string }>
  error?: string
}

export function useAsaasImport() {
  const [importing, setImporting] = useState(false)

  const importCustomers = async (): Promise<ImportResult> => {
    setImporting(true)
    
    try {
      const { data, error } = await supabase.functions.invoke('asaas-import-customers', {
        body: {}
      })

      if (error) {
        throw error
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao importar clientes')
      }

      // Mostrar toast de sucesso
      toast.success('Importação concluída!', {
        description: `${data.summary.imported} clientes importados, ${data.summary.duplicates} duplicados ignorados`
      })

      return data

    } catch (error) {
      console.error('Erro ao importar clientes:', error)
      toast.error('Erro ao importar clientes', {
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    } finally {
      setImporting(false)
    }
  }

  return {
    importing,
    importCustomers
  }
}
