import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, CheckCircle, Clock, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CronLog {
  id: string;
  job_name: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  execution_time_ms: number | null;
}

interface SystemStatus {
  total_pending: number;
  total_sent: number;
  total_failed: number;
  last_execution: string | null;
  whatsapp_connected: boolean;
  notifications_active: boolean;
}

export function NotificationSystemStatus() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [cronLogs, setCronLogs] = useState<CronLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const loadSystemStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) return;

      // Get notification statistics
      const { data: notificationStats } = await supabase
        .from('payment_notifications')
        .select('status')
        .eq('company_id', profile.company_id);

      const stats = notificationStats?.reduce((acc: any, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, {}) || {};

      // Check WhatsApp connection
      const { data: whatsappSettings } = await supabase
        .from('whatsapp_settings')
        .select('connection_status, is_active')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .single();

      // Check notification settings
      const { data: notificationSettings } = await supabase
        .from('payment_notification_settings')
        .select('active')
        .eq('company_id', profile.company_id)
        .single();

      // Get latest cron execution logs - buscar por todos os jobs de billing
      const { data: logs } = await supabase
        .from('cron_execution_logs')
        .select('*')
        .or('job_name.eq.billing-notifications-function,job_name.eq.billing-notifications-manual-9am,job_name.eq.billing-notifications-daily-3pm')
        .order('started_at', { ascending: false })
        .limit(10);

      setStatus({
        total_pending: stats.pending || 0,
        total_sent: stats.sent || 0,
        total_failed: stats.failed || 0,
        last_execution: logs?.[0]?.started_at || null,
        whatsapp_connected: whatsappSettings?.connection_status === 'connected',
        notifications_active: notificationSettings?.active || false
      });

      setCronLogs(logs || []);
    } catch (error: any) {
      console.error('Erro ao carregar status do sistema:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar status do sistema",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const forceNotificationCheck = async () => {
    try {
      setRefreshing(true);
      
      const { error } = await supabase.functions.invoke('billing-notifications', {
        body: { trigger: 'manual_check', force: true }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Verificação manual de notificações iniciada"
      });

      // Reload status after a short delay
      setTimeout(() => {
        loadSystemStatus();
      }, 2000);
    } catch (error: any) {
      console.error('Erro ao forçar verificação:', error);
      toast({
        title: "Erro",
        description: "Erro ao executar verificação manual",
        variant: "destructive"
      });
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSystemStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadSystemStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Não foi possível carregar o status</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (isHealthy: boolean) => 
    isHealthy ? "bg-green-500" : "bg-red-500";

  const getSystemHealth = () => {
    const issues = [];
    
    if (!status.notifications_active) issues.push("Notificações desativadas");
    if (!status.whatsapp_connected) issues.push("WhatsApp desconectado");
    if (status.total_failed > 0) issues.push(`${status.total_failed} notificações falharam`);
    
    const lastExecution = status.last_execution ? new Date(status.last_execution) : null;
    const minutesAgo = lastExecution ? (Date.now() - lastExecution.getTime()) / (1000 * 60) : null;
    
    if (!lastExecution || (minutesAgo && minutesAgo > 10)) {
      issues.push("Cron job não executou recentemente");
    }
    
    return issues;
  };

  const healthIssues = getSystemHealth();
  const isHealthy = healthIssues.length === 0;

  return (
    <div className="space-y-4">
      {/* System Health Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Status do Sistema de Notificações</CardTitle>
          <div className="flex items-center gap-2">
            <div 
              className={`w-3 h-3 rounded-full ${getStatusColor(isHealthy)}`}
              title={isHealthy ? "Sistema funcionando" : "Sistema com problemas"}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={loadSystemStatus}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{status.total_pending}</div>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{status.total_sent}</div>
              <p className="text-sm text-muted-foreground">Enviadas</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{status.total_failed}</div>
              <p className="text-sm text-muted-foreground">Falharam</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {status.last_execution 
                  ? `${Math.round((Date.now() - new Date(status.last_execution).getTime()) / (1000 * 60))}m`
                  : 'N/A'
                }
              </div>
              <p className="text-sm text-muted-foreground">Última exec.</p>
            </div>
          </div>

          {!isHealthy && (
            <div className="border-l-4 border-yellow-400 bg-yellow-50 p-4 mb-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">
                    Problemas detectados:
                  </h3>
                  <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                    {healthIssues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant={status.notifications_active ? "default" : "destructive"}>
              {status.notifications_active ? "Notificações Ativas" : "Notificações Inativas"}
            </Badge>
            <Badge variant={status.whatsapp_connected ? "default" : "destructive"}>
              {status.whatsapp_connected ? "WhatsApp Conectado" : "WhatsApp Desconectado"}
            </Badge>
          </div>

          <Button 
            onClick={forceNotificationCheck}
            disabled={refreshing}
            className="w-full"
          >
            <Activity className="h-4 w-4 mr-2" />
            Executar Verificação Manual
          </Button>
        </CardContent>
      </Card>

      {/* Cron Execution Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Últimas Execuções do Cron</CardTitle>
        </CardHeader>
        <CardContent>
          {cronLogs.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma execução registrada</p>
          ) : (
            <div className="space-y-2">
              {cronLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="flex items-center gap-2">
                    {log.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : log.status === 'error' ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="text-sm">
                      {new Date(log.started_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      log.status === 'success' ? 'default' :
                      log.status === 'error' ? 'destructive' : 'secondary'
                    }>
                      {log.status}
                    </Badge>
                    {log.execution_time_ms && (
                      <span className="text-xs text-muted-foreground">
                        {log.execution_time_ms}ms
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}