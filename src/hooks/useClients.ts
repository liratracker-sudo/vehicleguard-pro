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

  return {
    clients,
    loading,
    loadClients,
    createClient,
    updateClient,
    deleteClient
  };
}