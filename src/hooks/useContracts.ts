import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Contract {
  id: string;
  company_id: string;
  client_id: string;
  plan_id: string;
  vehicle_id: string | null;
  start_date: string;
  end_date: string | null;
  monthly_value: number;
  status: string;
  contract_type: string;
  signature_status: string;
  document_url: string | null;
  autentique_document_id: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
  // Relacionamentos
  clients?: {
    name: string;
    phone: string;
  } | null;
  plans?: {
    name: string;
  } | null;
  vehicles?: {
    license_plate: string;
    model: string;
    brand: string;
  } | null;
}

export function useContracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadContracts = async () => {
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
        .from('contracts')
        .select(`
          *,
          clients (
            name,
            phone
          ),
          plans (
            name
          ),
          vehicles (
            license_plate,
            model,
            brand
          )
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setContracts(data as any || []);
    } catch (error: any) {
      console.error('Erro ao carregar contratos:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar contratos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createContract = async (contractData: {
    client_id: string;
    plan_id: string;
    vehicle_id?: string;
    start_date: string;
    end_date?: string;
    monthly_value: number;
    contract_type?: string;
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

      const { data, error } = await supabase
        .from('contracts')
        .insert({
          ...contractData,
          company_id: profile.company_id,
          status: 'active',
          signature_status: 'pending',
          contract_type: contractData.contract_type || 'service'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Contrato criado com sucesso!"
      });

      await loadContracts(); // Recarregar a lista
      return data;
    } catch (error: any) {
      console.error('Erro ao criar contrato:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar contrato",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateContract = async (contractId: string, contractData: Partial<Omit<Contract, 'id' | 'created_at' | 'updated_at' | 'company_id'>>) => {
    try {
      const { error } = await supabase
        .from('contracts')
        .update(contractData)
        .eq('id', contractId);

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Contrato atualizado com sucesso!"
      });

      await loadContracts(); // Recarregar a lista
    } catch (error: any) {
      console.error('Erro ao atualizar contrato:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar contrato",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteContract = async (contractId: string) => {
    try {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', contractId);

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Contrato removido com sucesso!"
      });

      await loadContracts(); // Recarregar a lista
    } catch (error: any) {
      console.error('Erro ao remover contrato:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover contrato",
        variant: "destructive"
      });
      throw error;
    }
  };

  const sendForSignature = async (contractId: string) => {
    try {
      // Aqui seria a integração com a Autentique API
      // Por enquanto, apenas atualizamos o status
      await updateContract(contractId, {
        signature_status: 'sent'
      });

      toast({
        title: "Enviado",
        description: "Contrato enviado para assinatura eletrônica!"
      });
    } catch (error: any) {
      console.error('Erro ao enviar para assinatura:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar para assinatura",
        variant: "destructive"
      });
      throw error;
    }
  };

  useEffect(() => {
    loadContracts();
  }, []);

  return {
    contracts,
    loading,
    loadContracts,
    createContract,
    updateContract,
    deleteContract,
    sendForSignature
  };
}