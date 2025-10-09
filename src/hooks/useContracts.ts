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
  assinafy_document_id: string | null;
  // Removido: autentique_document_id (migrado para assinafy_document_id)
  signed_at: string | null;
  created_at: string;
  updated_at: string;
  // Relacionamentos
  clients?: {
    name: string;
    phone: string;
    email: string;
    document?: string;
  } | null;
  plans?: {
    name: string;
    description?: string;
    price: number;
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
          .select('id, name, phone, email, document')
          .eq('company_id', profile.company_id),
        supabase
          .from('plans')
          .select('id, name, description, price')
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

      console.log('Iniciando envio para assinatura - Contrato:', contractId)

      // Get client details
      const { data: client } = await supabase
        .from('clients')
        .select('name, email, phone, document')
        .eq('id', contract.client_id)
        .single()

      if (!client) {
        throw new Error('Cliente não encontrado')
      }

      if (!client.email) {
        throw new Error('Cliente deve ter um email cadastrado para envio')
      }

      console.log('Cliente encontrado:', { name: client.name, email: client.email })

      // Get plan details  
      const { data: plan } = await supabase
        .from('plans')
        .select('name, description, price')
        .eq('id', contract.plan_id)
        .single()

      // Call Assinafy integration
      console.log('Chamando API Assinafy para criar documento...')
      
      const response = await supabase.functions.invoke('assinafy-integration', {
        body: {
          action: 'createDocument',
          contract_id: contractId, // Pass contract_id for logging
          client_name: client.name,
          client_email: client.email,
          client_cpf: client.document,
          content: generateContractContent(contract, client, plan),
          title: `Contrato ${contract.id.substring(0, 8)} - ${client.name}`
        }
      })

      console.log('Resposta completa da API Assinafy:', JSON.stringify(response, null, 2))

      if (response.error) {
        console.error('❌ Erro na edge function:', response.error)
        throw new Error(`Problema na integração: ${response.error.message || 'Erro na Edge Function'}`)
      }

      if (!response.data?.success) {
        console.error('❌ Erro retornado pela API Assinafy:', response.data)
        const errorDetails = response.data?.details ? `\n\nDetalhes: ${JSON.stringify(response.data.details, null, 2)}` : ''
        throw new Error(response.data?.error || `Erro ao criar documento no Assinafy.${errorDetails}`)
      }

      const documentId = response.data.document_id
      const signingUrl = response.data.signing_url
      console.log('Documento criado com sucesso. ID:', documentId)

      // Update contract with Assinafy document ID and signing URL
      const { error: updateError } = await supabase
        .from('contracts')
        .update({ 
          signature_status: 'pending',
          assinafy_document_id: documentId,
          document_url: signingUrl
        })
        .eq('id', contractId)

      if (updateError) throw updateError

      // Send WhatsApp notifications to client and company
      console.log('Enviando notificações WhatsApp...')
      
      // Get current user and company info
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (profile?.company_id) {
          const { data: company } = await supabase
            .from('companies')
            .select('name, phone')
            .eq('id', profile.company_id)
            .maybeSingle()

          // Send to client
          const clientMessage = `Olá ${client.name}! 📄\n\nSeu contrato está pronto para assinatura digital.\n\nAcesse o link abaixo para assinar:\n${signingUrl}\n\nEm caso de dúvidas, entre em contato.`
          
          try {
            await supabase.functions.invoke('whatsapp-evolution', {
              body: {
                action: 'sendMessage',
                payload: {
                  phone: client.phone,
                  message: clientMessage,
                  instance_name: 'luck' // Replace with dynamic instance if needed
                }
              }
            })
            console.log('✅ Mensagem WhatsApp enviada para o cliente')
          } catch (whatsappError) {
            console.error('Erro ao enviar WhatsApp para cliente:', whatsappError)
          }

          // Send to company if phone exists
          if (company?.phone) {
            const companyMessage = `📄 Novo contrato enviado para assinatura!\n\nCliente: ${client.name}\nContrato: ${contract.id.substring(0, 8)}\n\nLink de assinatura:\n${signingUrl}`
            
            try {
              await supabase.functions.invoke('whatsapp-evolution', {
                body: {
                  action: 'sendMessage',
                  payload: {
                    phone: company.phone,
                    message: companyMessage,
                    instance_name: 'luck' // Replace with dynamic instance if needed
                  }
                }
              })
              console.log('✅ Mensagem WhatsApp enviada para a empresa')
            } catch (whatsappError) {
              console.error('Erro ao enviar WhatsApp para empresa:', whatsappError)
            }
          }
        }
      }

      toast({
        title: "Enviado",
        description: "Contrato enviado para assinatura! Notificações WhatsApp enviadas."
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
${client.document ? `CPF/CNPJ: ${client.document}` : ''}

PLANO: ${plan?.name || 'Não especificado'}
${plan?.description ? `DESCRIÇÃO: ${plan.description}` : ''}
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