import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, X, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

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

      setAlerts(systemAlerts || []);
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

  if (loading || alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mb-4">
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
  );
};