import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface ContractTemplate {
  id: string
  company_id: string
  name: string
  content: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export const useContractTemplates = () => {
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const loadTemplates = async () => {
    try {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile?.company_id) throw new Error('Perfil da empresa não encontrado')

      const { data, error } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('name')

      if (error) throw error

      setTemplates(data || [])
    } catch (error: any) {
      console.error('Erro ao carregar modelos:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar modelos de contrato",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const createTemplate = async (templateData: { name: string; content: string }): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile?.company_id) throw new Error('Perfil da empresa não encontrado')

      const { error } = await supabase
        .from('contract_templates')
        .insert({
          name: templateData.name,
          content: templateData.content,
          company_id: profile.company_id
        })

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Modelo criado com sucesso!"
      })

      await loadTemplates()
      return true
    } catch (error: any) {
      console.error('Erro ao criar modelo:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar modelo",
        variant: "destructive"
      })
      return false
    }
  }

  const updateTemplate = async (templateId: string, templateData: { name: string; content: string }): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('contract_templates')
        .update({
          name: templateData.name,
          content: templateData.content
        })
        .eq('id', templateId)

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Modelo atualizado com sucesso!"
      })

      await loadTemplates()
      return true
    } catch (error: any) {
      console.error('Erro ao atualizar modelo:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar modelo",
        variant: "destructive"
      })
      return false
    }
  }

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('contract_templates')
        .update({ is_active: false })
        .eq('id', templateId)

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Modelo removido com sucesso!"
      })

      await loadTemplates()
    } catch (error: any) {
      console.error('Erro ao remover modelo:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover modelo",
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  return {
    templates,
    loading,
    loadTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate
  }
}