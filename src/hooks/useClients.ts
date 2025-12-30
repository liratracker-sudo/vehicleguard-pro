import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  document: string | null;
  address: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  company_id: string;
  whatsapp_opt_out: boolean | null;
  whatsapp_blocked: boolean | null;
  whatsapp_block_reason: string | null;
  whatsapp_failures: number | null;
  is_courtesy: boolean | null;
}

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadClients = async () => {
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
        .from('clients')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name');

      if (error) {
        throw error;
      }

      setClients(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar clientes:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar clientes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createClient = async (clientData: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'company_id'>) => {
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
        .from('clients')
        .insert({
          ...clientData,
          company_id: profile.company_id
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Cliente cadastrado com sucesso!"
      });

      await loadClients(); // Recarregar a lista
    } catch (error: any) {
      console.error('Erro ao criar cliente:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao cadastrar cliente",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateClient = async (clientId: string, clientData: Partial<Omit<Client, 'id' | 'created_at' | 'updated_at' | 'company_id'>>) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update(clientData)
        .eq('id', clientId);

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Cliente atualizado com sucesso!"
      });

      await loadClients(); // Recarregar a lista
    } catch (error: any) {
      console.error('Erro ao atualizar cliente:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar cliente",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteClient = async (clientId: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Cliente removido com sucesso!"
      });

      await loadClients(); // Recarregar a lista
    } catch (error: any) {
      console.error('Erro ao remover cliente:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover cliente",
        variant: "destructive"
      });
      throw error;
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const toggleWhatsApp = async (clientId: string, currentOptOut: boolean | null) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ whatsapp_opt_out: !currentOptOut })
        .eq('id', clientId);

      if (error) throw error;

      toast({
        title: currentOptOut ? "WhatsApp habilitado" : "WhatsApp desabilitado",
        description: currentOptOut 
          ? "O cliente voltará a receber mensagens automáticas"
          : "O cliente não receberá mais mensagens automáticas"
      });

      await loadClients();
    } catch (error: any) {
      console.error('Erro ao alterar WhatsApp:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao alterar configuração de WhatsApp",
        variant: "destructive"
      });
    }
  };

  const unblockWhatsApp = async (clientId: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ 
          whatsapp_blocked: false, 
          whatsapp_block_reason: null,
          whatsapp_failures: 0
        })
        .eq('id', clientId);

      if (error) throw error;

      toast({
        title: "WhatsApp desbloqueado",
        description: "O cliente foi desbloqueado e voltará a receber mensagens"
      });

      await loadClients();
    } catch (error: any) {
      console.error('Erro ao desbloquear WhatsApp:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao desbloquear WhatsApp",
        variant: "destructive"
      });
    }
  };

  return {
    clients,
    loading,
    loadClients,
    createClient,
    updateClient,
    deleteClient,
    toggleWhatsApp,
    unblockWhatsApp
  };
}