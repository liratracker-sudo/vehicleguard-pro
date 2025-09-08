import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppConnectionState {
  isConnected: boolean;
  instanceName: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'expired';
  sessionId: string | null;
  companyId: string | null;
  lastChecked: Date | null;
}

interface WhatsAppContextType {
  connectionState: WhatsAppConnectionState;
  checkConnection: () => Promise<boolean>;
  reconnect: () => Promise<boolean>;
  refreshConnection: () => void;
  validateSession: () => Promise<boolean>;
}

const WhatsAppContext = createContext<WhatsAppContextType | undefined>(undefined);

export const useWhatsAppConnection = () => {
  const context = useContext(WhatsAppContext);
  if (!context) {
    throw new Error('useWhatsAppConnection must be used within a WhatsAppProvider');
  }
  return context;
};

export const WhatsAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionState, setConnectionState] = useState<WhatsAppConnectionState>({
    isConnected: false,
    instanceName: null,
    connectionStatus: 'disconnected',
    sessionId: null,
    companyId: null,
    lastChecked: null
  });

  const { toast } = useToast();

  // Função para obter company_id do usuário logado
  const getUserCompanyId = async (): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      return profile?.company_id || null;
    } catch (error) {
      console.error('Erro ao obter company_id:', error);
      return null;
    }
  };

  // Função para verificar conexão com Evolution API
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const companyId = await getUserCompanyId();
      if (!companyId) return false;

      // Buscar configurações do WhatsApp
      const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .maybeSingle();

      if (!settings) {
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
          connectionStatus: 'disconnected',
          companyId,
          lastChecked: new Date()
        }));
        return false;
      }

      // Verificar conexão com Evolution API
      const response = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'check_connection',
          instance_url: settings.instance_url,
          api_token: settings.api_token,
          instance_name: settings.instance_name
        }
      });

      const isConnected = response.data?.connected === true && response.data?.state === 'open';

      // Atualizar estado local
      setConnectionState(prev => ({
        ...prev,
        isConnected,
        instanceName: settings.instance_name,
        connectionStatus: isConnected ? 'connected' : 'disconnected',
        companyId,
        lastChecked: new Date()
      }));

      // Atualizar sessão no banco se mudou
      if (isConnected !== (settings.connection_status === 'connected')) {
        await supabase
          .from('whatsapp_settings')
          .update({ 
            connection_status: isConnected ? 'connected' : 'disconnected' 
          })
          .eq('company_id', companyId);

        // Atualizar ou criar sessão
        await supabase
          .from('whatsapp_sessions')
          .upsert({
            company_id: companyId,
            session_id: settings.instance_name,
            instance_name: settings.instance_name,
            token: settings.api_token,
            status: isConnected ? 'connected' : 'disconnected'
          }, {
            onConflict: 'company_id,instance_name'
          });
      }

      return isConnected;
    } catch (error) {
      console.error('Erro ao verificar conexão:', error);
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        connectionStatus: 'disconnected',
        lastChecked: new Date()
      }));
      return false;
    }
  }, []);

  // Função para reconectar
  const reconnect = useCallback(async (): Promise<boolean> => {
    try {
      setConnectionState(prev => ({ ...prev, connectionStatus: 'reconnecting' }));

      const companyId = await getUserCompanyId();
      if (!companyId) return false;

      const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .maybeSingle();

      if (!settings) return false;

      // Tentar reconectar
      const response = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'createSession',
          payload: {
            instance_name: settings.instance_name,
            token: settings.api_token,
            webhooks: [
              {
                url: `${window.location.origin}/api/webhooks/whatsapp`,
                events: ['messages.upsert', 'connection.update']
              }
            ]
          }
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao reconectar');
      }

      const success = await checkConnection();
      
      if (success) {
        toast({
          title: "Reconectado!",
          description: "WhatsApp Evolution reconectado com sucesso"
        });
      }

      return success;
    } catch (error: any) {
      console.error('Erro ao reconectar:', error);
      setConnectionState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
      toast({
        title: "Erro na reconexão",
        description: error.message || "Falha ao reconectar com WhatsApp Evolution",
        variant: "destructive"
      });
      return false;
    }
  }, [checkConnection, toast]);

  // Função para validar sessão usando middleware do banco
  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      const companyId = await getUserCompanyId();
      if (!companyId) return false;

      const { data, error } = await supabase
        .rpc('validate_whatsapp_session', { p_company_id: companyId });

      if (error) {
        console.error('Erro ao validar sessão:', error);
        return false;
      }

      const validation = data?.[0];
      if (!validation?.is_valid) {
        // Sessão inválida - mostrar alerta e tentar reconectar
        if (validation?.session_status === 'expired') {
          toast({
            title: "Sessão Expirada",
            description: validation.message + " Tentando reconectar...",
            variant: "destructive"
          });
          
          // Tentar reconectar automaticamente
          setTimeout(() => reconnect(), 2000);
        }
        
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
          connectionStatus: validation?.session_status as any || 'disconnected'
        }));
        
        return false;
      }

      setConnectionState(prev => ({
        ...prev,
        isConnected: true,
        connectionStatus: 'connected',
        instanceName: validation.instance_name
      }));
      
      return true;
    } catch (error) {
      console.error('Erro ao validar sessão:', error);
      return false;
    }
  }, [reconnect, toast]);

  // Função para forçar refresh
  const refreshConnection = useCallback(() => {
    checkConnection();
  }, [checkConnection]);

  // Verificação inicial e periódica
  useEffect(() => {
    // Verificar conexão imediatamente
    checkConnection();

    // Verificar a cada 30 segundos
    const interval = setInterval(() => {
      checkConnection();
    }, 30000);

    // Verificar quando a aba ganhar foco
    const handleFocus = () => {
      checkConnection();
    };

    // Verificar quando houver mudança de rota (navegação)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkConnection();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkConnection]);

  // Validação mais profunda a cada 2 minutos
  useEffect(() => {
    const validationInterval = setInterval(() => {
      if (connectionState.isConnected) {
        validateSession();
      }
    }, 120000); // 2 minutos

    return () => clearInterval(validationInterval);
  }, [connectionState.isConnected, validateSession]);

  return (
    <WhatsAppContext.Provider value={{
      connectionState,
      checkConnection,
      reconnect,
      refreshConnection,
      validateSession
    }}>
      {children}
    </WhatsAppContext.Provider>
  );
};