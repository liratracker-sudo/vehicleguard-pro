import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PaymentGatewayRule {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  min_amount: number;
  max_amount?: number;
  allowed_gateways: string[];
  allowed_methods: string[];
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRuleData {
  name: string;
  description?: string;
  min_amount: number;
  max_amount?: number;
  allowed_gateways: string[];
  allowed_methods: string[];
  priority?: number;
  is_active?: boolean;
}

export function usePaymentGatewayRules() {
  const [rules, setRules] = useState<PaymentGatewayRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadCompanyId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    return profile?.company_id || null;
  };

  const loadRules = async () => {
    try {
      setLoading(true);
      const compId = await loadCompanyId();
      if (!compId) return;
      
      setCompanyId(compId);

      const { data, error } = await supabase
        .from('payment_gateway_rules')
        .select('*')
        .eq('company_id', compId)
        .order('priority', { ascending: true });

      if (error) throw error;
      setRules((data as PaymentGatewayRule[]) || []);
    } catch (error) {
      console.error('Error loading gateway rules:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar regras de gateway',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const createRule = async (data: CreateRuleData) => {
    try {
      if (!companyId) {
        const compId = await loadCompanyId();
        if (!compId) throw new Error('Company not found');
        setCompanyId(compId);
      }

      const { error } = await supabase
        .from('payment_gateway_rules')
        .insert({
          company_id: companyId,
          ...data,
        });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Regra criada com sucesso',
      });

      await loadRules();
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar regra',
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateRule = async (id: string, data: Partial<CreateRuleData>) => {
    try {
      const { error } = await supabase
        .from('payment_gateway_rules')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Regra atualizada com sucesso',
      });

      await loadRules();
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar regra',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteRule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('payment_gateway_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Regra removida com sucesso',
      });

      await loadRules();
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao remover regra',
        variant: 'destructive',
      });
      return false;
    }
  };

  const toggleRule = async (id: string, isActive: boolean) => {
    return updateRule(id, { is_active: isActive });
  };

  return {
    rules,
    loading,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    refreshRules: loadRules,
  };
}
