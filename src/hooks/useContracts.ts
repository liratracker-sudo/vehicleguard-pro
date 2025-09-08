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

      // Buscar contratos básicos primeiro
      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (contractsError) {
        throw contractsError;
      }

      // Buscar dados relacionados separadamente
      const [clientsData, plansData, vehiclesData] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, phone')
          .eq('company_id', profile.company_id),
        supabase
          .from('plans')
          .select('id, name')
          .eq('company_id', profile.company_id),
        supabase
          .from('vehicles')
          .select('id, license_plate, model, brand')
          .eq('company_id', profile.company_id)
      ]);

      // Mapear dados relacionados aos contratos
      const enrichedContracts = (contractsData || []).map(contract => {
        const client = clientsData.data?.find(c => c.id === contract.client_id);
        const plan = plansData.data?.find(p => p.id === contract.plan_id);
        const vehicle = contract.vehicle_id 
          ? vehiclesData.data?.find(v => v.id === contract.vehicle_id)
          : null;

        return {
          ...contract,
          clients: client,
          plans: plan,
          vehicles: vehicle
        };
      });

      setContracts(enrichedContracts || []);
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
      const contract = contracts.find(c => c.id === contractId)
      if (!contract) {
        throw new Error('Contrato não encontrado')
      }

      // Get client details
      const { data: client } = await supabase
        .from('clients')
        .select('name, email, phone')
        .eq('id', contract.client_id)
        .single()

      if (!client) {
        throw new Error('Cliente não encontrado')
      }

      // Get plan details  
      const { data: plan } = await supabase
        .from('plans')
        .select('name')
        .eq('id', contract.plan_id)
        .single()

      // Call Autentique integration
      const response = await supabase.functions.invoke('autentique-integration', {
        body: {
          action: 'create_document',
          contractData: {
            client_name: client.name,
            client_email: client.email,
            client_phone: client.phone,
            contract_title: `Contrato de Prestação de Serviços - ${client.name}`,
            contract_content: generateContractContent(contract, client, plan)
          }
        }
      })

      if (response.error) {
        throw new Error(response.error.message)
      }

      // Update contract with Autentique document ID and send for signature
      const { error: updateError } = await supabase
        .from('contracts')
        .update({ 
          signature_status: 'sent',
          autentique_document_id: response.data.document.id,
          document_url: `https://app.autentique.com.br/document/${response.data.document.id}`
        })
        .eq('id', contractId)

      if (updateError) throw updateError

      // Now send for signature
      const signatureResponse = await supabase.functions.invoke('autentique-integration', {
        body: {
          action: 'send_for_signature',
          documentId: response.data.document.id,
          contractData: {
            client_name: client.name,
            client_email: client.email,
            client_phone: client.phone
          }
        }
      })

      if (signatureResponse.error) {
        console.warn('Erro ao enviar para assinatura, mas documento foi criado:', signatureResponse.error)
      }

      toast({
        title: "Enviado",
        description: "Contrato enviado para assinatura eletrônica!"
      })

      await loadContracts() // Reload to get updated status
    } catch (error: any) {
      console.error('Erro ao enviar para assinatura:', error)
      toast({
        title: "Erro", 
        description: error.message || "Erro ao enviar para assinatura",
        variant: "destructive"
      })
      throw error
    }
  }

  const generateContractContent = (contract: Contract, client: any, plan: any) => {
    return `
CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: ${client.name}
E-mail: ${client.email}
Telefone: ${client.phone}

PLANO: ${plan?.name || 'Não especificado'}
VALOR MENSAL: R$ ${contract.monthly_value.toFixed(2)}

${contract.vehicles ? `VEÍCULO: ${contract.vehicles.license_plate} - ${contract.vehicles.brand} ${contract.vehicles.model}` : ''}

VIGÊNCIA: ${new Date(contract.start_date).toLocaleDateString('pt-BR')} ${contract.end_date ? `até ${new Date(contract.end_date).toLocaleDateString('pt-BR')}` : '(prazo indeterminado)'}

TIPO DE CONTRATO: ${contract.contract_type === 'service' ? 'Prestação de Serviços' : contract.contract_type === 'rental' ? 'Locação' : 'Manutenção'}

Este contrato estabelece os termos e condições para a prestação dos serviços contratados.

_________________________________
Assinatura do Contratante
    `
  }

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