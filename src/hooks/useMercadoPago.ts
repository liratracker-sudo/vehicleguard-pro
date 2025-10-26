import { useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

export const useMercadoPago = () => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const createCustomer = async (customerData: {
    email: string
    first_name: string
    last_name: string
    phone?: {
      area_code: string
      number: string
    }
    identification?: {
      type: string
      number: string
    }
    description?: string
    address?: any
  }) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('mercadopago-integration', {
        body: {
          action: 'create_customer',
          ...customerData
        }
      })

      if (error) throw error
      return data
    } catch (error: any) {
      console.error('Error creating customer:', error)
      toast({
        title: "Erro ao criar cliente",
        description: error.message,
        variant: "destructive"
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  const createPreference = async (preferenceData: {
    items: Array<{
      title: string
      quantity: number
      unit_price: number
      description?: string
    }>
    payer?: {
      name?: string
      surname?: string
      email?: string
      phone?: {
        area_code: string
        number: string
      }
      identification?: {
        type: string
        number: string
      }
      address?: any
    }
    back_urls?: {
      success?: string
      failure?: string
      pending?: string
    }
    auto_return?: 'approved' | 'all'
    payment_methods?: {
      excluded_payment_methods?: Array<{ id: string }>
      excluded_payment_types?: Array<{ id: string }>
      installments?: number
    }
    notification_url?: string
    external_reference?: string
    statement_descriptor?: string
    expires?: boolean
    expiration_date_from?: string
    expiration_date_to?: string
  }) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('mercadopago-integration', {
        body: {
          action: 'create_preference',
          ...preferenceData
        }
      })

      if (error) throw error
      return data
    } catch (error: any) {
      console.error('Error creating preference:', error)
      toast({
        title: "Erro ao criar preferência",
        description: error.message,
        variant: "destructive"
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  const getPayment = async (paymentId: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('mercadopago-integration', {
        body: {
          action: 'get_payment',
          payment_id: paymentId
        }
      })

      if (error) throw error
      return data
    } catch (error: any) {
      console.error('Error getting payment:', error)
      toast({
        title: "Erro ao buscar pagamento",
        description: error.message,
        variant: "destructive"
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  const cancelPayment = async (paymentId: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('mercadopago-integration', {
        body: {
          action: 'cancel_payment',
          payment_id: paymentId
        }
      })

      if (error) throw error
      
      toast({
        title: "Pagamento cancelado",
        description: "O pagamento foi cancelado com sucesso."
      })
      
      return data
    } catch (error: any) {
      console.error('Error canceling payment:', error)
      toast({
        title: "Erro ao cancelar pagamento",
        description: error.message,
        variant: "destructive"
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    createCustomer,
    createPreference,
    getPayment,
    cancelPayment
  }
}