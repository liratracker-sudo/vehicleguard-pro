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
  reconnectAttempts: number;
  isChecking: boolean;
  autoReconnectEnabled: boolean;
  lastDisconnectedAt: Date | null;
}

interface WhatsAppContextType {
  connectionState: WhatsAppConnectionState;
  checkConnection: () => Promise<boolean>;
  reconnect: () => Promise<boolean>;
  refreshConnection: () => void;
  validateSession: () => Promise<boolean>;
  setAutoReconnect: (enabled: boolean) => void;
  triggerManualReconnect: () => void;
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
    lastChecked: null,
    reconnectAttempts: 0,
    isChecking: false,
    autoReconnectEnabled: true,
    lastDisconnectedAt: null
  });

  const [wasConnected, setWasConnected] = useState(false);

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
      // Evitar verificações simultâneas
      if (connectionState.isChecking) {
        return connectionState.isConnected;
      }

      setConnectionState(prev => ({ ...prev, isChecking: true }));

      const companyId = await getUserCompanyId();
      if (!companyId) {
        setConnectionState(prev => ({ ...prev, isChecking: false }));
        return false;
      }

      // Buscar configurações do WhatsApp
      const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .maybeSingle();

      if (!settings || !settings.instance_url || !settings.api_token || !settings.instance_name) {
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
          connectionStatus: 'disconnected',
          companyId,
          lastChecked: new Date(),
          isChecking: false
        }));
        return false;
      }

      // Verificar conexão com Evolution API
      const response = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'check_connection',
          instance_name: settings.instance_name,
          company_id: companyId
        }
      });

      const isConnected = response.data?.state === 'open';

      // Atualizar estado local
      setConnectionState(prev => ({
        ...prev,
        isConnected,
        instanceName: settings.instance_name,
        connectionStatus: isConnected ? 'connected' : 'disconnected',
        companyId,
        lastChecked: new Date(),
        isChecking: false,
        reconnectAttempts: isConnected ? 0 : prev.reconnectAttempts
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
        lastChecked: new Date(),
        isChecking: false
      }));
      return false;
    }
  }, [connectionState.isChecking, connectionState.isConnected]);

  // Função para reconectar com backoff exponential
  const reconnect = useCallback(async (): Promise<boolean> => {
    try {
      // Limitar tentativas de reconexão
      if (connectionState.reconnectAttempts >= 5) {
        toast({
          title: "Muitas tentativas",
          description: "Muitas tentativas de reconexão. Aguarde alguns minutos.",
          variant: "destructive"
        });
        return false;
      }

      setConnectionState(prev => ({ 
        ...prev, 
        connectionStatus: 'reconnecting',
        reconnectAttempts: prev.reconnectAttempts + 1
      }));

      const companyId = await getUserCompanyId();
      if (!companyId) return false;

      const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .maybeSingle();

      if (!settings || !settings.instance_url || !settings.api_token || !settings.instance_name) {
        setConnectionState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
        return false;
      }

      // Aguardar com backoff exponencial (2^tentativas segundos)
      const delay = Math.min(1000 * Math.pow(2, connectionState.reconnectAttempts), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Tentar reconectar
      const response = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'get_qr_code',
          instance_name: settings.instance_name,
          force_new: false,
          company_id: companyId
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao reconectar');
      }

      // Verificar se conectou após a tentativa
      setTimeout(async () => {
        const success = await checkConnection();
        if (success) {
          setConnectionState(prev => ({ ...prev, reconnectAttempts: 0 }));
          toast({
            title: "Reconectado!",
            description: "WhatsApp Evolution reconectado com sucesso"
          });
        }
      }, 3000);

      return true;
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
  }, [connectionState.reconnectAttempts, checkConnection, toast]);

  // Função para validar sessão - DESABILITADO após restauração DB
  const validateSession = useCallback(async (): Promise<boolean> => {
    // RPC validate_whatsapp_session não existe após restauração
    console.warn('validateSession: função RPC não disponível');
    return false;
  }, []);

  // Função para forçar refresh
  const refreshConnection = useCallback(() => {
    checkConnection();
  }, [checkConnection]);

  // Verificação inicial e periódica (mais conservadora)
  useEffect(() => {
    // Verificar conexão imediatamente apenas uma vez
    checkConnection();

    // Verificar a cada 5 minutos (aumentado de 2 minutos)
    const interval = setInterval(() => {
      // Só verificar se não estiver já verificando e se passou tempo suficiente
      if (!connectionState.isChecking && 
          (!connectionState.lastChecked || 
           Date.now() - connectionState.lastChecked.getTime() > 300000)) { // 5 minutos
        checkConnection();
      }
    }, 300000); // 5 minutos

    // Cleanup
    return () => {
      clearInterval(interval);
    };
  }, []); // Remover dependências para evitar re-execução

  // NOVO: Listener em tempo real para detectar mudanças na conexão
  useEffect(() => {
    let channel: any;

    const setupRealtimeListener = async () => {
      const companyId = await getUserCompanyId();
      if (!companyId) return;

      // Escutar mudanças na tabela whatsapp_settings
      channel = supabase
        .channel('whatsapp-connection-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'whatsapp_settings',
            filter: `company_id=eq.${companyId}`
          },
          (payload) => {
            console.log('WhatsApp settings mudou:', payload);
            const newData = payload.new as any;
            
            // Atualizar estado imediatamente quando detectar mudança
            if (newData.connection_status) {
              setConnectionState(prev => ({
                ...prev,
                isConnected: newData.connection_status === 'connected',
                connectionStatus: newData.connection_status,
                instanceName: newData.instance_name,
                lastChecked: new Date()
              }));

              // Mostrar notificação se mudou para conectado
              if (newData.connection_status === 'connected' && !connectionState.isConnected) {
                toast({
                  title: "WhatsApp Conectado!",
                  description: "Sua instância do WhatsApp foi conectada com sucesso"
                });
              }
            }
          }
        )
        .subscribe();

      console.log('Listener em tempo real configurado para company_id:', companyId);
    };

    setupRealtimeListener();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []); // Executar apenas uma vez no mount

  // Reset de tentativas de reconexão após um tempo
  useEffect(() => {
    if (connectionState.reconnectAttempts > 0 && connectionState.connectionStatus === 'connected') {
      setConnectionState(prev => ({ ...prev, reconnectAttempts: 0 }));
    }

    // Reset automático de tentativas após 10 minutos
    if (connectionState.reconnectAttempts >= 5) {
      const resetTimeout = setTimeout(() => {
        setConnectionState(prev => ({ ...prev, reconnectAttempts: 0 }));
      }, 600000); // 10 minutos

      return () => clearTimeout(resetTimeout);
    }
  }, [connectionState.reconnectAttempts, connectionState.connectionStatus]);

  // NOVO: Detectar desconexão e iniciar reconexão automática
  useEffect(() => {
    // Atualizar estado de "estava conectado"
    if (connectionState.isConnected && !wasConnected) {
      setWasConnected(true);
    }

    // Detectar desconexão
    if (!connectionState.isConnected && wasConnected) {
      console.log('🔴 WhatsApp desconectou! Registrando momento da desconexão...');
      
      setConnectionState(prev => ({
        ...prev,
        lastDisconnectedAt: new Date()
      }));

      // Iniciar reconexão automática se habilitada
      if (connectionState.autoReconnectEnabled && connectionState.reconnectAttempts < 3) {
        console.log('🔄 Iniciando reconexão automática em 5 segundos...');
        
        const autoReconnectTimer = setTimeout(async () => {
          console.log('🔄 Tentando reconexão automática...');
          const success = await reconnect();
          if (success) {
            console.log('✅ Reconexão automática bem sucedida!');
          } else {
            console.log('❌ Reconexão automática falhou');
          }
        }, 5000);

        return () => clearTimeout(autoReconnectTimer);
      }
    }

    // Resetar wasConnected quando reconectar
    if (!connectionState.isConnected && !wasConnected) {
      // Mantém wasConnected como false
    }
  }, [connectionState.isConnected, wasConnected, connectionState.autoReconnectEnabled, connectionState.reconnectAttempts]);

  // Função para habilitar/desabilitar reconexão automática
  const setAutoReconnect = useCallback((enabled: boolean) => {
    setConnectionState(prev => ({ ...prev, autoReconnectEnabled: enabled }));
  }, []);

  // Função para forçar reconexão manual (reseta contador)
  const triggerManualReconnect = useCallback(() => {
    setConnectionState(prev => ({ ...prev, reconnectAttempts: 0 }));
    reconnect();
  }, [reconnect]);

  return (
    <WhatsAppContext.Provider value={{
      connectionState,
      checkConnection,
      reconnect,
      refreshConnection,
      validateSession,
      setAutoReconnect,
      triggerManualReconnect
    }}>
      {children}
    </WhatsAppContext.Provider>
  );
};