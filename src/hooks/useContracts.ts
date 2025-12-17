import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ContractVehicle {
  id: string;
  license_plate: string;
  model: string;
  brand: string;
}

export interface Contract {
  id: string;
  company_id: string;
  client_id: string;
  plan_id: string;
  vehicle_id: string | null; // Deprecated
  start_date: string;
  end_date: string | null;
  monthly_value: number;
  status: string;
  contract_type: string;
  signature_status: string;
  document_url: string | null;
  assinafy_document_id: string | null;
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
  vehicles?: ContractVehicle | null; // Retrocompatibilidade
  contract_vehicles?: ContractVehicle[]; // Nova estrutura
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

      // Buscar contratos básicos
      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (contractsError) {
        throw contractsError;
      }

      // Buscar dados relacionados
      const [clientsData, plansData, vehiclesData, contractVehiclesData] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, phone, email, document')
          .eq('company_id', profile.company_id)
          .order('name'),
        supabase
          .from('plans')
          .select('id, name, description, price')
          .eq('company_id', profile.company_id),
        supabase
          .from('vehicles')
          .select('id, license_plate, model, brand')
          .eq('company_id', profile.company_id),
        supabase
          .from('contract_vehicles')
          .select('contract_id, vehicle_id')
      ]);

      // Mapear dados relacionados aos contratos
      const enrichedContracts = (contractsData || []).map(contract => {
        const client = clientsData.data?.find(c => c.id === contract.client_id);
        const plan = plansData.data?.find(p => p.id === contract.plan_id);
        
        // Buscar veículos da nova tabela
        const contractVehicleIds = contractVehiclesData.data
          ?.filter(cv => cv.contract_id === contract.id)
          .map(cv => cv.vehicle_id) || [];
        
        const contractVehicles = vehiclesData.data?.filter(v => 
          contractVehicleIds.includes(v.id)
        ) || [];

        // Retrocompatibilidade: se não tem na nova tabela mas tem vehicle_id antigo
        const legacyVehicle = contract.vehicle_id && contractVehicles.length === 0
          ? vehiclesData.data?.find(v => v.id === contract.vehicle_id)
          : null;

        return {
          ...contract,
          clients: client,
          plans: plan,
          vehicles: contractVehicles[0] || legacyVehicle || null, // Para exibição simples
          contract_vehicles: contractVehicles.length > 0 ? contractVehicles : (legacyVehicle ? [legacyVehicle] : [])
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
    vehicle_ids?: string[];
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

      const { vehicle_ids, ...rest } = contractData;

      const { data, error } = await supabase
        .from('contracts')
        .insert({
          ...rest,
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

      // Inserir veículos relacionados
      if (vehicle_ids && vehicle_ids.length > 0) {
        const { error: vehiclesError } = await supabase
          .from('contract_vehicles')
          .insert(vehicle_ids.map(vid => ({
            contract_id: data.id,
            vehicle_id: vid
          })));
        
        if (vehiclesError) throw vehiclesError;
      }

      toast({
        title: "Sucesso",
        description: "Contrato criado com sucesso!"
      });

      await loadContracts();
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

      await loadContracts();
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
      // contract_vehicles será deletado automaticamente via CASCADE
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

      await loadContracts();
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

  const syncContractStatus = async (contractId: string, assinafyDocumentId: string): Promise<boolean> => {
    try {
      console.log(`Sincronizando status do contrato ${contractId}...`)
      
      const response = await supabase.functions.invoke('assinafy-integration', {
        body: {
          action: 'syncStatus',
          document_id: assinafyDocumentId,
          contract_id: contractId
        }
      })

      if (response.error || !response.data?.success) {
        console.error('Erro ao sincronizar status:', response.error || response.data)
        return false
      }

      console.log('Status sincronizado:', response.data)
      return response.data.status_changed || false
    } catch (error) {
      console.error('Erro na sincronização:', error)
      return false
    }
  }

  const sendForSignature = async (contractId: string) => {
    try {
      const contract = contracts.find(c => c.id === contractId)
      if (!contract) {
        throw new Error('Contrato não encontrado')
      }

      console.log('Iniciando envio para assinatura - Contrato:', contractId)

      // Buscar dados do cliente, plano e empresa em paralelo
      const [clientResult, planResult, companyResult, adminResult] = await Promise.all([
        supabase
          .from('clients')
          .select('name, email, phone, document')
          .eq('id', contract.client_id)
          .single(),
        supabase
          .from('plans')
          .select('name, description, price')
          .eq('id', contract.plan_id)
          .single(),
        supabase
          .from('companies')
          .select('name, cnpj, address')
          .eq('id', contract.company_id)
          .single(),
        supabase
          .from('profiles')
          .select('full_name')
          .eq('company_id', contract.company_id)
          .eq('role', 'admin')
          .limit(1)
          .maybeSingle()
      ])

      const client = clientResult.data
      const plan = planResult.data
      const company = companyResult.data
      const adminProfile = adminResult.data

      if (!client) {
        throw new Error('Cliente não encontrado')
      }

      if (!client.email) {
        throw new Error('Cliente deve ter um email cadastrado para envio')
      }

      console.log('Cliente encontrado:', { name: client.name, email: client.email })

      // Montar informações da empresa (CONTRATADA)
      const companyInfo = {
        name: company?.name,
        cnpj: company?.cnpj,
        address: company?.address,
        ownerName: adminProfile?.full_name
      }

      console.log('Empresa encontrada:', companyInfo)
      console.log('Chamando API Assinafy para criar documento...')
      
      const response = await supabase.functions.invoke('assinafy-integration', {
        body: {
          action: 'createDocument',
          contract_id: contractId,
          client_name: client.name,
          client_email: client.email,
          client_cpf: client.document,
          content: generateContractContent(contract, client, plan, companyInfo),
          title: `Contrato ${contract.id.substring(0, 8)} - ${client.name}`,
          company_name: companyInfo.name,
          company_cnpj: companyInfo.cnpj,
          company_address: companyInfo.address,
          company_owner: companyInfo.ownerName
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
      console.log('Contrato atualizado pela edge function - document_id:', documentId)

      console.log('Enviando notificações WhatsApp...')
      
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (profile?.company_id) {
          // Buscar configurações do WhatsApp da empresa
          const { data: whatsappSettings } = await supabase
            .from('whatsapp_settings')
            .select('instance_url, instance_name, api_token, is_active, connection_status')
            .eq('company_id', profile.company_id)
            .eq('is_active', true)
            .maybeSingle()

          // Verificar se WhatsApp está configurado e conectado
          if (!whatsappSettings || whatsappSettings.connection_status !== 'connected') {
            console.log('⚠️ WhatsApp não configurado ou desconectado - pulando notificações')
          } else {

            const clientMessage = `Olá ${client.name}! 📄\n\nSeu contrato está pronto para assinatura digital.\n\n📋 *Plano:* ${plan?.name || 'Contratado'}\n💰 *Valor:* R$ ${contract.monthly_value.toFixed(2)}/mês\n\n🔗 *Acesse o link abaixo para assinar:*\n${signingUrl}\n\nEm caso de dúvidas, entre em contato.`
            
            try {
              await supabase.functions.invoke('whatsapp-evolution', {
                body: {
                  action: 'send_message',
                  instance_url: whatsappSettings.instance_url,
                  api_token: whatsappSettings.api_token,
                  instance_name: whatsappSettings.instance_name,
                  phone_number: client.phone,
                  message: clientMessage,
                  company_id: profile.company_id,
                  client_id: contract.client_id
                }
              })
              console.log('✅ Mensagem WhatsApp enviada para o cliente')
            } catch (whatsappError) {
              console.error('Erro ao enviar WhatsApp para cliente:', whatsappError)
            }

          }
        }
      }

      toast({
        title: "Enviado",
        description: "Contrato enviado para assinatura! Notificações WhatsApp enviadas."
      })

      await loadContracts()
      
      setTimeout(async () => {
        console.log('Auto-sincronizando status após envio...')
        const statusChanged = await syncContractStatus(contractId, documentId)
        if (statusChanged) {
          await loadContracts()
        }
      }, 5000)
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

  const resendSignatureNotification = async (contractId: string) => {
    try {
      const contract = contracts.find(c => c.id === contractId)
      if (!contract) {
        throw new Error('Contrato não encontrado')
      }

      if (!contract.assinafy_document_id || !contract.document_url) {
        throw new Error('Este contrato ainda não foi enviado para assinatura')
      }

      console.log('Reenviando notificação para contrato:', contractId)

      // Buscar dados do cliente e empresa em paralelo
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile?.company_id) throw new Error('Perfil não encontrado')

      const [clientResult, planResult, whatsappResult] = await Promise.all([
        supabase
          .from('clients')
          .select('name, phone')
          .eq('id', contract.client_id)
          .single(),
        supabase
          .from('plans')
          .select('name')
          .eq('id', contract.plan_id)
          .single(),
        supabase
          .from('whatsapp_settings')
          .select('instance_url, instance_name, api_token, is_active, connection_status')
          .eq('company_id', profile.company_id)
          .eq('is_active', true)
          .maybeSingle()
      ])

      const client = clientResult.data
      const plan = planResult.data
      const whatsappSettings = whatsappResult.data

      if (!client) throw new Error('Cliente não encontrado')
      if (!client.phone) throw new Error('Cliente não possui telefone cadastrado')

      if (!whatsappSettings || whatsappSettings.connection_status !== 'connected') {
        throw new Error('WhatsApp não está configurado ou conectado')
      }

      // Montar mensagem de lembrete
      const message = `Olá ${client.name}! 📄\n\n` +
        `Estamos reenviando o link do seu contrato que ainda aguarda assinatura.\n\n` +
        `📋 *Plano:* ${plan?.name || 'Contratado'}\n` +
        `💰 *Valor:* R$ ${contract.monthly_value.toFixed(2)}/mês\n\n` +
        `🔗 *Acesse o link abaixo para assinar:*\n${contract.document_url}\n\n` +
        `Em caso de dúvidas, entre em contato.`

      // Enviar mensagem WhatsApp
      const { error: whatsappError } = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'send_message',
          instance_url: whatsappSettings.instance_url,
          api_token: whatsappSettings.api_token,
          instance_name: whatsappSettings.instance_name,
          phone_number: client.phone,
          message: message,
          company_id: profile.company_id,
          client_id: contract.client_id
        }
      })

      if (whatsappError) throw whatsappError

      console.log('✅ Notificação reenviada com sucesso')

      toast({
        title: "Notificação enviada",
        description: `Lembrete de assinatura enviado para ${client.name}`
      })
    } catch (error: any) {
      console.error('Erro ao reenviar notificação:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao reenviar notificação",
        variant: "destructive"
      })
      throw error
    }
  }

  const generateContractContent = (
    contract: Contract, 
    client: any, 
    plan: any,
    companyInfo?: { name?: string; cnpj?: string; address?: string; ownerName?: string }
  ) => {
    // Gerar seção de veículos
    const vehiclesSection = contract.contract_vehicles && contract.contract_vehicles.length > 0
      ? `VEÍCULOS COBERTOS:\n${contract.contract_vehicles.map((v, i) => `${i + 1}. ${v.license_plate} - ${v.brand} ${v.model}`).join('\n')}`
      : contract.vehicles
        ? `VEÍCULO: ${contract.vehicles.license_plate} - ${contract.vehicles.brand} ${contract.vehicles.model}`
        : ''

    return `
CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATADA: ${companyInfo?.name || '[Nome da Empresa]'}
CNPJ: ${companyInfo?.cnpj || '[CNPJ]'}
Endereço: ${companyInfo?.address || '[Endereço]'}
Responsável: ${companyInfo?.ownerName || '[Responsável]'}

CONTRATANTE: ${client.name}
E-mail: ${client.email}
Telefone: ${client.phone}
${client.document ? `CPF/CNPJ: ${client.document}` : ''}

PLANO: ${plan?.name || 'Não especificado'}
${plan?.description ? `DESCRIÇÃO: ${plan.description}` : ''}
VALOR MENSAL: R$ ${contract.monthly_value.toFixed(2)}

${vehiclesSection}

VIGÊNCIA: ${new Date(contract.start_date).toLocaleDateString('pt-BR')} ${contract.end_date ? `até ${new Date(contract.end_date).toLocaleDateString('pt-BR')}` : '(prazo indeterminado)'}

TIPO DE CONTRATO: ${contract.contract_type === 'service' ? 'Prestação de Serviços' : contract.contract_type === 'rental' ? 'Locação' : 'Manutenção'}

Este contrato estabelece os termos e condições para a prestação dos serviços contratados.

_________________________________
${client.name}
Contratante

_________________________________
${companyInfo?.ownerName || '[Responsável]'}
${companyInfo?.name || '[Nome da Empresa]'}
Contratada
    `
  }

  useEffect(() => {
    loadContracts();

    const syncInterval = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!profile?.company_id) return;

      const { data: contractsData } = await supabase
        .from('contracts')
        .select('id, signature_status, assinafy_document_id')
        .eq('company_id', profile.company_id)
        .eq('signature_status', 'pending')
        .not('assinafy_document_id', 'is', null);

      if (contractsData && contractsData.length > 0) {
        console.log(`Auto-sincronizando ${contractsData.length} contrato(s) pendente(s)...`)
        
        let anyChanged = false
        for (const contract of contractsData) {
          const changed = await syncContractStatus(contract.id, contract.assinafy_document_id!)
          if (changed) anyChanged = true
        }

        if (anyChanged) {
          await loadContracts()
        }
      }
    }, 30000)

    return () => clearInterval(syncInterval)
  }, []);

  return {
    contracts,
    loading,
    loadContracts,
    createContract,
    updateContract,
    deleteContract,
    sendForSignature,
    syncContractStatus,
    resendSignatureNotification
  };
}