import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Plan {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  price: number;
  billing_cycle: string;
  features: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [contractCounts, setContractCounts] = useState<Record<string, number>>({});
  const { toast } = useToast();

  const loadPlans = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.company_id) {
        throw new Error('Perfil da empresa não encontrado');
      }

      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setPlans(data || []);

      // Carregar contagem de contratos para cada plano
      if (data && data.length > 0) {
        const counts: Record<string, number> = {};
        for (const plan of data) {
          const { count } = await supabase
            .from('contracts')
            .select('*', { count: 'exact', head: true })
            .eq('plan_id', plan.id);
          counts[plan.id] = count || 0;
        }
        setContractCounts(counts);
      }
    } catch (error: any) {
      console.error('Erro ao carregar planos:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar planos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createPlan = async (planData: {
    name: string;
    description?: string;
    price: number;
    billing_cycle?: string;
    features?: string[];
    is_active?: boolean;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.company_id) {
        throw new Error('Perfil da empresa não encontrado');
      }

      const { error } = await supabase
        .from('plans')
        .insert({
          ...planData,
          company_id: profile.company_id,
          billing_cycle: planData.billing_cycle || 'monthly',
          is_active: planData.is_active ?? true
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Plano criado com sucesso!"
      });

      await loadPlans();
    } catch (error: any) {
      console.error('Erro ao criar plano:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar plano",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updatePlan = async (planId: string, planData: Partial<Omit<Plan, 'id' | 'created_at' | 'updated_at' | 'company_id'>>) => {
    try {
      const { error } = await supabase
        .from('plans')
        .update(planData)
        .eq('id', planId);

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Plano atualizado com sucesso!"
      });

      await loadPlans();
    } catch (error: any) {
      console.error('Erro ao atualizar plano:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar plano",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deletePlan = async (planId: string): Promise<boolean> => {
    try {
      // Verificar se há contratos usando este plano
      const { count, error: countError } = await supabase
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .eq('plan_id', planId);

      if (countError) throw countError;

      if (count && count > 0) {
        toast({
          title: "Não é possível excluir",
          description: `Este plano possui ${count} contrato(s) vinculado(s). Desative o plano ou remova os contratos primeiro.`,
          variant: "destructive"
        });
        return false;
      }

      const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', planId);

      if (error) {
        // Se o banco bloquear por causa da constraint RESTRICT
        if (error.message.includes('violates foreign key constraint')) {
          toast({
            title: "Não é possível excluir",
            description: "Este plano possui contratos vinculados. Desative o plano ao invés de excluir.",
            variant: "destructive"
          });
          return false;
        }
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Plano removido com sucesso!"
      });

      await loadPlans();
      return true;
    } catch (error: any) {
      console.error('Erro ao remover plano:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover plano",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deactivatePlan = async (planId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('plans')
        .update({ is_active: false })
        .eq('id', planId);

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Plano desativado com sucesso! Ele não aparecerá em novas contratações."
      });

      await loadPlans();
      return true;
    } catch (error: any) {
      console.error('Erro ao desativar plano:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao desativar plano",
        variant: "destructive"
      });
      throw error;
    }
  };

  const getContractCount = async (planId: string): Promise<number> => {
    const { count } = await supabase
      .from('contracts')
      .select('*', { count: 'exact', head: true })
      .eq('plan_id', planId);
    return count || 0;
  };

  useEffect(() => {
    loadPlans();
  }, []);

  return {
    plans,
    loading,
    contractCounts,
    loadPlans,
    createPlan,
    updatePlan,
    deletePlan,
    deactivatePlan,
    getContractCount
  };
}
