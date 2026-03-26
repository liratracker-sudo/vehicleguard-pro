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

const defaultState: WhatsAppConnectionState = {
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
};

const defaultContext: WhatsAppContextType = {
  connectionState: defaultState,
  checkConnection: async () => false,
  reconnect: async () => false,
  refreshConnection: () => {},
  validateSession: async () => false,
  setAutoReconnect: () => {},
  triggerManualReconnect: () => {},
};

const WhatsAppContext = createContext<WhatsAppContextType>(defaultContext);

// Safe hook - returns default values when outside provider (no throw)
export const useWhatsAppConnection = () => {
  return useContext(WhatsAppContext);
};

export const WhatsAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionState, setConnectionState] = useState<WhatsAppConnectionState>(defaultState);
  const [wasConnected, setWasConnected] = useState(false);
  const { toast } = useToast();

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

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      if (connectionState.isChecking) return connectionState.isConnected;
      setConnectionState(prev => ({ ...prev, isChecking: true }));

      const companyId = await getUserCompanyId();
      if (!companyId) {
        setConnectionState(prev => ({ ...prev, isChecking: false }));
        return false;
      }

      const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .maybeSingle();

      if (!settings || !settings.instance_url || !settings.api_token || !settings.instance_name) {
        setConnectionState(prev => ({ ...prev, isConnected: false, connectionStatus: 'disconnected', companyId, lastChecked: new Date(), isChecking: false }));
        return false;
      }

      const response = await supabase.functions.invoke('whatsapp-evolution', {
        body: { action: 'check_connection', instance_name: settings.instance_name, company_id: companyId }
      });

      const isConnected = response.data?.state === 'open';

      setConnectionState(prev => ({
        ...prev, isConnected, instanceName: settings.instance_name,
        connectionStatus: isConnected ? 'connected' : 'disconnected',
        companyId, lastChecked: new Date(), isChecking: false,
        reconnectAttempts: isConnected ? 0 : prev.reconnectAttempts
      }));

      if (isConnected !== (settings.connection_status === 'connected')) {
        await supabase.from('whatsapp_settings').update({ connection_status: isConnected ? 'connected' : 'disconnected' }).eq('company_id', companyId);
        await supabase.from('whatsapp_sessions').upsert({ company_id: companyId, session_id: settings.instance_name, instance_name: settings.instance_name, token: settings.api_token, status: isConnected ? 'connected' : 'disconnected' }, { onConflict: 'company_id,instance_name' });
      }

      return isConnected;
    } catch (error) {
      console.error('Erro ao verificar conexão:', error);
      setConnectionState(prev => ({ ...prev, isConnected: false, connectionStatus: 'disconnected', lastChecked: new Date(), isChecking: false }));
      return false;
    }
  }, [connectionState.isChecking, connectionState.isConnected]);

  const reconnect = useCallback(async (): Promise<boolean> => {
    try {
      if (connectionState.reconnectAttempts >= 5) {
        toast({ title: "Muitas tentativas", description: "Muitas tentativas de reconexão. Aguarde alguns minutos.", variant: "destructive" });
        return false;
      }

      setConnectionState(prev => ({ ...prev, connectionStatus: 'reconnecting', reconnectAttempts: prev.reconnectAttempts + 1 }));

      const companyId = await getUserCompanyId();
      if (!companyId) return false;

      const { data: settings } = await supabase.from('whatsapp_settings').select('*').eq('company_id', companyId).eq('is_active', true).maybeSingle();
      if (!settings || !settings.instance_url || !settings.api_token || !settings.instance_name) {
        setConnectionState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
        return false;
      }

      const delay = Math.min(1000 * Math.pow(2, connectionState.reconnectAttempts), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));

      const response = await supabase.functions.invoke('whatsapp-evolution', {
        body: { action: 'get_qr_code', instance_name: settings.instance_name, force_new: false, company_id: companyId }
      });

      if (response.error) throw new Error(response.error.message || 'Erro ao reconectar');

      setTimeout(async () => {
        const success = await checkConnection();
        if (success) {
          setConnectionState(prev => ({ ...prev, reconnectAttempts: 0 }));
          toast({ title: "Reconectado!", description: "WhatsApp Evolution reconectado com sucesso" });
        }
      }, 3000);

      return true;
    } catch (error: any) {
      console.error('Erro ao reconectar:', error);
      setConnectionState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
      toast({ title: "Erro na reconexão", description: error.message || "Falha ao reconectar com WhatsApp Evolution", variant: "destructive" });
      return false;
    }
  }, [connectionState.reconnectAttempts, checkConnection, toast]);

  const validateSession = useCallback(async (): Promise<boolean> => {
    console.warn('validateSession: função RPC não disponível');
    return false;
  }, []);

  const refreshConnection = useCallback(() => { checkConnection(); }, [checkConnection]);

  const setAutoReconnect = useCallback((enabled: boolean) => {
    setConnectionState(prev => ({ ...prev, autoReconnectEnabled: enabled }));
  }, []);

  const triggerManualReconnect = useCallback(() => {
    setConnectionState(prev => ({ ...prev, reconnectAttempts: 0 }));
    reconnect();
  }, [reconnect]);

  // Delayed initial check + periodic (5min)
  useEffect(() => {
    const initialTimer = setTimeout(() => { checkConnection(); }, 5000);
    const interval = setInterval(() => {
      if (!connectionState.isChecking && (!connectionState.lastChecked || Date.now() - connectionState.lastChecked.getTime() > 300000)) {
        checkConnection();
      }
    }, 300000);
    return () => { clearTimeout(initialTimer); clearInterval(interval); };
  }, []);

  // Realtime listener
  useEffect(() => {
    let channel: any;
    const setup = async () => {
      const companyId = await getUserCompanyId();
      if (!companyId) return;
      channel = supabase.channel('whatsapp-connection-changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_settings', filter: `company_id=eq.${companyId}` }, (payload) => {
          const newData = payload.new as any;
          if (newData.connection_status) {
            setConnectionState(prev => ({ ...prev, isConnected: newData.connection_status === 'connected', connectionStatus: newData.connection_status, instanceName: newData.instance_name, lastChecked: new Date() }));
            if (newData.connection_status === 'connected' && !connectionState.isConnected) {
              toast({ title: "WhatsApp Conectado!", description: "Sua instância do WhatsApp foi conectada com sucesso" });
            }
          }
        }).subscribe();
    };
    setup();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  // Reconnect attempts reset
  useEffect(() => {
    if (connectionState.reconnectAttempts > 0 && connectionState.connectionStatus === 'connected') {
      setConnectionState(prev => ({ ...prev, reconnectAttempts: 0 }));
    }
    if (connectionState.reconnectAttempts >= 5) {
      const t = setTimeout(() => setConnectionState(prev => ({ ...prev, reconnectAttempts: 0 })), 600000);
      return () => clearTimeout(t);
    }
  }, [connectionState.reconnectAttempts, connectionState.connectionStatus]);

  // Auto-reconnect on disconnect
  useEffect(() => {
    if (connectionState.isConnected && !wasConnected) setWasConnected(true);
    if (!connectionState.isConnected && wasConnected) {
      setConnectionState(prev => ({ ...prev, lastDisconnectedAt: new Date() }));
      if (connectionState.autoReconnectEnabled && connectionState.reconnectAttempts < 3) {
        const t = setTimeout(() => { reconnect(); }, 5000);
        return () => clearTimeout(t);
      }
    }
  }, [connectionState.isConnected, wasConnected, connectionState.autoReconnectEnabled, connectionState.reconnectAttempts]);

  return (
    <WhatsAppContext.Provider value={{ connectionState, checkConnection, reconnect, refreshConnection, validateSession, setAutoReconnect, triggerManualReconnect }}>
      {children}
    </WhatsAppContext.Provider>
  );
};
