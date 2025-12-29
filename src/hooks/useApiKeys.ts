import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { useCompanyId } from '@/hooks/useCompanyId'

interface ApiKey {
  id: string
  name: string
  api_key_prefix: string
  is_active: boolean
  permissions: any
  last_used_at: string | null
  created_at: string
}

interface ApiUsageLog {
  id: string
  endpoint: string
  method: string
  response_status: number
  response_time_ms: number
  created_at: string
}

// Simple hash function matching the edge function
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(apiKey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Generate a random API key
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'sk_live_'
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function useApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [usageLogs, setUsageLogs] = useState<ApiUsageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const { toast } = useToast()
  const { companyId } = useCompanyId()

  const fetchApiKeys = async () => {
    if (!companyId) return

    try {
      const { data, error } = await supabase
        .from('company_api_keys')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setApiKeys(data || [])
    } catch (error) {
      console.error('Error fetching API keys:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsageLogs = async (limit = 100) => {
    if (!companyId) return

    try {
      const { data, error } = await supabase
        .from('api_usage_logs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      setUsageLogs(data || [])
    } catch (error) {
      console.error('Error fetching usage logs:', error)
    }
  }

  useEffect(() => {
    if (companyId) {
      fetchApiKeys()
      fetchUsageLogs()
    }
  }, [companyId])

  const createApiKey = async (name: string, permissions?: ApiKey['permissions']): Promise<string | null> => {
    if (!companyId) return null

    setCreating(true)
    try {
      const apiKey = generateApiKey()
      const apiKeyHash = await hashApiKey(apiKey)
      const apiKeyPrefix = apiKey.substring(0, 12) + '...'

      const { error } = await supabase
        .from('company_api_keys')
        .insert({
          company_id: companyId,
          name,
          api_key_hash: apiKeyHash,
          api_key_prefix: apiKeyPrefix,
          permissions: permissions || {
            read_clients: true,
            read_vehicles: true,
            read_payments: true,
            create_charges: true,
          },
        })

      if (error) throw error

      toast({
        title: 'API Key criada',
        description: 'Copie a chave agora, ela não será exibida novamente.',
      })

      await fetchApiKeys()
      return apiKey
    } catch (error: any) {
      console.error('Error creating API key:', error)
      toast({
        title: 'Erro ao criar API Key',
        description: error.message,
        variant: 'destructive',
      })
      return null
    } finally {
      setCreating(false)
    }
  }

  const toggleApiKey = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('company_api_keys')
        .update({ is_active: isActive })
        .eq('id', id)

      if (error) throw error

      toast({
        title: isActive ? 'API Key ativada' : 'API Key desativada',
      })

      await fetchApiKeys()
    } catch (error: any) {
      console.error('Error toggling API key:', error)
      toast({
        title: 'Erro ao atualizar API Key',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const deleteApiKey = async (id: string) => {
    try {
      const { error } = await supabase
        .from('company_api_keys')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'API Key excluída',
      })

      await fetchApiKeys()
    } catch (error: any) {
      console.error('Error deleting API key:', error)
      toast({
        title: 'Erro ao excluir API Key',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  return {
    apiKeys,
    usageLogs,
    loading,
    creating,
    createApiKey,
    toggleApiKey,
    deleteApiKey,
    refreshKeys: fetchApiKeys,
    refreshLogs: fetchUsageLogs,
  }
}
