import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface AsaasCustomer {
  id: string
  name: string
  email: string
  phone: string
  cpfCnpj: string
  address?: string
  city?: string
  state?: string
  postalCode?: string
}

export interface AsaasCharge {
  id: string
  customer: string
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'DEBIT_CARD'
  value: number
  dueDate: string
  description: string
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED'
  invoiceUrl?: string
  bankSlipUrl?: string
  pixCode?: string
  pixQrCodeUrl?: string
}

export interface AsaasSettings {
  isConfigured: boolean
  isSandbox: boolean
  lastTestAt?: string
  testResult?: any
}

export function useAsaas() {
  const [settings, setSettings] = useState<AsaasSettings>({ isConfigured: false, isSandbox: true })
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile?.company_id) return

      const { data: asaasSettings } = await supabase
        .from('asaas_settings')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .maybeSingle()

      if (asaasSettings) {
        setSettings({
          isConfigured: true,
          isSandbox: asaasSettings.is_sandbox,
          lastTestAt: asaasSettings.last_test_at,
          testResult: asaasSettings.test_result
        })
      }
    } catch (error) {
      console.error('Erro ao carregar configurações do Asaas:', error)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const testConnection = async () => {
    setLoading(true)
    try {
      const response = await supabase.functions.invoke('asaas-integration', {
        body: {
          action: 'test_connection'
        }
      })

      if (response.error) {
        throw new Error(response.error.message)
      }

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Falha ao testar conexão')
      }

      toast({
        title: "Sucesso",
        description: "Conexão com Asaas testada com sucesso!"
      })

      await loadSettings()
      return response.data
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  const createCustomer = async (customerData: Partial<AsaasCustomer>) => {
    setLoading(true)
    try {
      const response = await supabase.functions.invoke('asaas-integration', {
        body: {
          action: 'create_customer',
          data: customerData
        }
      })

      if (response.error) {
        throw new Error(response.error.message)
      }

      if (!response.data?.success) {
        throw new Error('Falha ao criar cliente no Asaas')
      }

      toast({
        title: "Sucesso",
        description: "Cliente criado no Asaas com sucesso!"
      })

      return response.data.customer
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  const createCharge = async (chargeData: {
    customerId: string
    billingType: string
    dueDate: string
    value: number
    description: string
    externalReference?: string
  }) => {
    setLoading(true)
    try {
      const response = await supabase.functions.invoke('asaas-integration', {
        body: {
          action: 'create_charge',
          data: chargeData
        }
      })

      if (response.error) {
        throw new Error(response.error.message)
      }

      if (!response.data?.success) {
        throw new Error('Falha ao criar cobrança no Asaas')
      }

      toast({
        title: "Sucesso",
        description: "Cobrança criada no Asaas com sucesso!"
      })

      return response.data.charge
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  const getCustomer = async (customerId: string) => {
    setLoading(true)
    try {
      const response = await supabase.functions.invoke('asaas-integration', {
        body: {
          action: 'get_customer',
          data: { customerId }
        }
      })

      if (response.error) {
        throw new Error(response.error.message)
      }

      if (!response.data?.success) {
        throw new Error('Falha ao buscar cliente no Asaas')
      }

      return response.data.customer
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  const listCharges = async (filters?: {
    customerId?: string
    status?: string
    limit?: number
    offset?: number
  }) => {
    setLoading(true)
    try {
      const response = await supabase.functions.invoke('asaas-integration', {
        body: {
          action: 'list_charges',
          data: filters || {}
        }
      })

      if (response.error) {
        throw new Error(response.error.message)
      }

      if (!response.data?.success) {
        throw new Error('Falha ao listar cobranças do Asaas')
      }

      return response.data.charges
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  return {
    settings,
    loading,
    testConnection,
    createCustomer,
    createCharge,
    getCustomer,
    listCharges,
    loadSettings
  }
}