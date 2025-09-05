import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface WhatsAppSession {
  id: string;
  company_id: string;
  session_id: string;
  token: string | null;
  status: string;
  instance_name: string;
  qr_code: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export function useWhatsAppSession() {
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadSession = async () => {
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
        .from('whatsapp_sessions')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setSession(data);
    } catch (error: any) {
      console.error('Erro ao carregar sessão WhatsApp:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar sessão WhatsApp",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createOrUpdateSession = async (sessionData: {
    session_id: string;
    token?: string;
    status: string;
    instance_name: string;
    qr_code?: string;
    expires_at?: string;
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
        .from('whatsapp_sessions')
        .upsert({
          company_id: profile.company_id,
          ...sessionData
        }, {
          onConflict: 'company_id,instance_name'
        });

      if (error) {
        throw error;
      }

      await loadSession(); // Recarregar a sessão
    } catch (error: any) {
      console.error('Erro ao salvar sessão WhatsApp:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar sessão WhatsApp",
        variant: "destructive"
      });
      throw error;
    }
  };

  const validateSession = async (): Promise<boolean> => {
    if (!session) return false;

    try {
      // Verificar se a sessão ainda é válida via API do WhatsApp Evolution
      const response = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'checkConnection',
          payload: {
            instance_name: session.instance_name
          }
        }
      });

      if (response.error) {
        console.error('Erro ao validar sessão:', response.error);
        return false;
      }

      const isConnected = response.data?.state === 'open';
      
      // Atualizar status no banco se mudou
      if (isConnected && session.status !== 'connected') {
        await createOrUpdateSession({
          ...session,
          status: 'connected'
        });
      } else if (!isConnected && session.status === 'connected') {
        await createOrUpdateSession({
          ...session,
          status: 'disconnected'
        });
      }

      return isConnected;
    } catch (error) {
      console.error('Erro ao validar sessão WhatsApp:', error);
      return false;
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  return {
    session,
    loading,
    loadSession,
    createOrUpdateSession,
    validateSession
  };
}