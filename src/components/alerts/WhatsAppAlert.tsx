import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, X, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useWhatsAppConnection } from '@/contexts/WhatsAppContext';
import { ReconnectDialog } from '@/components/whatsapp/ReconnectDialog';

interface SystemAlert {
  id: string;
  type: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  created_at: string;
  dismissed_at?: string;
}

export const WhatsAppAlert: React.FC = () => {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReconnectDialog, setShowReconnectDialog] = useState(false);
  const [dismissedConnectionAlert, setDismissedConnectionAlert] = useState(false);
  const { toast } = useToast();
  const { connectionState, triggerManualReconnect } = useWhatsAppConnection();

  const loadAlerts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) return;

      // Get recent undismissed WhatsApp alerts
      const { data: systemAlerts, error } = await supabase
        .from('system_alerts')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('type', 'whatsapp_connection')
        .is('dismissed_at', null)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error('Error loading WhatsApp alerts:', error);
        return;
      }

      setAlerts((systemAlerts || []).map(alert => ({
        ...alert,
        severity: (alert.severity as 'warning' | 'error' | 'info') || 'warning'
      })));
    } catch (error) {
      console.error('Error loading WhatsApp alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismissAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('system_alerts')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) {
        toast({
          title: "Erro",
          description: "Erro ao dispensar alerta",
          variant: "destructive"
        });
        return;
      }

      setAlerts(alerts.filter(alert => alert.id !== alertId));
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <WifiOff className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Wifi className="w-4 h-4" />;
    }
  };

  const getSeverityVariant = (severity: string): "default" | "destructive" => {
    return severity === 'error' ? 'destructive' : 'default';
  };

  useEffect(() => {
    loadAlerts();
    
    // Refresh alerts every 30 seconds
    const interval = setInterval(loadAlerts, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Verificar se deve mostrar alerta de conexão
  const showConnectionAlert = !connectionState.isConnected && 
    connectionState.instanceName && 
    !dismissedConnectionAlert &&
    connectionState.connectionStatus !== 'connecting' &&
    connectionState.connectionStatus !== 'reconnecting';

  // Reset do dismissed quando conectar
  useEffect(() => {
    if (connectionState.isConnected) {
      setDismissedConnectionAlert(false);
    }
  }, [connectionState.isConnected]);

  // Não mostrar nada se não há alertas
  if (loading && !showConnectionAlert) {
    return null;
  }

  const formatTimeSince = (date: Date | null) => {
    if (!date) return '';
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours}h`;
    return `há ${Math.floor(hours / 24)} dias`;
  };

  return (
    <>
      <div className="space-y-2 mb-4">
        {/* Alerta de conexão em tempo real */}
        {showConnectionAlert && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <div className="flex items-start gap-3">
              <WifiOff className="w-5 h-5 mt-0.5 text-destructive" />
              <div className="flex-1">
                <AlertDescription className="text-sm font-medium">
                  WhatsApp Desconectado
                </AlertDescription>
                <p className="text-xs text-muted-foreground mt-1">
                  Sua instância "{connectionState.instanceName}" está offline.
                  {connectionState.lastDisconnectedAt && (
                    <span className="ml-1">
                      Desconectado {formatTimeSince(connectionState.lastDisconnectedAt)}.
                    </span>
                  )}
                  {connectionState.reconnectAttempts > 0 && (
                    <span className="ml-1">
                      Tentativas: {connectionState.reconnectAttempts}/3
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReconnectDialog(true)}
                  className="h-8 text-xs border-destructive/30 hover:bg-destructive/10"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Reconectar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDismissedConnectionAlert(true)}
                  className="h-8 w-8 p-0 hover:bg-destructive/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Alert>
        )}

        {/* Alertas do sistema (do banco) */}
        {alerts.map((alert) => (
          <Alert key={alert.id} variant={getSeverityVariant(alert.severity)}>
            <div className="flex items-start gap-2">
              {getSeverityIcon(alert.severity)}
              <div className="flex-1">
                <AlertDescription className="text-sm">
                  <strong>WhatsApp:</strong> {alert.message}
                </AlertDescription>
                <div className="text-xs opacity-70 mt-1">
                  {new Date(alert.created_at).toLocaleString()}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissAlert(alert.id)}
                className="h-auto p-1 hover:bg-transparent"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </Alert>
        ))}
      </div>

      {/* Dialog de reconexão rápida */}
      <ReconnectDialog 
        open={showReconnectDialog} 
        onOpenChange={setShowReconnectDialog} 
      />
    </>
  );
};