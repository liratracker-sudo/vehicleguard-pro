import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Clock, Users, Calendar, History, Activity, Play } from "lucide-react";
import { NotificationHistory } from "@/components/billing/NotificationHistory";
import { NotificationSystemStatus } from "@/components/billing/NotificationSystemStatus";
import { BillingNotificationsModal } from "./BillingNotificationsModal";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface NotificationSettings {
  id: string;
  company_id: string;
  active: boolean;
  pre_due_days: number[];
  on_due: boolean;
  post_due_days: number[];
  send_hour: string;
  template_pre_due: string;
  template_on_due: string;
  template_post_due: string;
  on_due_times: number;
  on_due_interval_hours: number;
  max_attempts_per_notification: number;
  retry_interval_hours: number;
}

export function BillingNotifications() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [activeTab, setActiveTab] = useState<"settings" | "history" | "status">("settings");
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
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
        .single();

      if (!profile?.company_id) {
        throw new Error('Perfil da empresa não encontrado');
      }

      const { data, error } = await supabase
        .from('payment_notification_settings')
        .select('*')
        .eq('company_id', profile.company_id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(data);
      } else {
        // Create default settings
        const defaultSettings = {
          company_id: profile.company_id,
          active: true,
          pre_due_days: [3],
          on_due: true,
          post_due_days: [2],
          send_hour: '09:00',
          template_pre_due: 'Olá {{cliente}}, lembramos que seu pagamento de R$ {{valor}} vence em {{dias}} dia(s) ({{vencimento}}). Pague aqui: {{link_pagamento}}',
          template_on_due: 'Olá {{cliente}}, seu pagamento de R$ {{valor}} vence hoje ({{vencimento}}). Pague aqui: {{link_pagamento}}',
          template_post_due: 'Olá {{cliente}}, identificamos atraso de {{dias}} dia(s) no pagamento de R$ {{valor}} vencido em {{vencimento}}. Regularize: {{link_pagamento}}',
          on_due_times: 1,
          on_due_interval_hours: 2,
          max_attempts_per_notification: 3,
          retry_interval_hours: 1
        };
        
        const { data: created, error: createError } = await supabase
          .from('payment_notification_settings')
          .insert(defaultSettings)
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        setSettings(created);
      }
    } catch (error: any) {
      console.error('Erro ao carregar configurações:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar configurações de notificação",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (updatedSettings: NotificationSettings) => {
    try {
      setSaving(true);
      
      // Validate required fields
      if (updatedSettings.pre_due_days.length === 0 && !updatedSettings.on_due && updatedSettings.post_due_days.length === 0) {
        throw new Error('Configure pelo menos um tipo de notificação');
      }

      if (updatedSettings.on_due && (!updatedSettings.on_due_times || updatedSettings.on_due_times < 1)) {
        throw new Error('Quantidade de disparos deve ser pelo menos 1');
      }

      console.log('Saving notification settings:', {
        active: updatedSettings.active,
        pre_due_days: updatedSettings.pre_due_days,
        on_due: updatedSettings.on_due,
        post_due_days: updatedSettings.post_due_days,
        send_hour: updatedSettings.send_hour,
        on_due_times: updatedSettings.on_due_times,
        on_due_interval_hours: updatedSettings.on_due_interval_hours,
        max_attempts_per_notification: updatedSettings.max_attempts_per_notification,
        retry_interval_hours: updatedSettings.retry_interval_hours
      });

      const { error } = await supabase
        .from('payment_notification_settings')
        .update({
          active: updatedSettings.active,
          pre_due_days: updatedSettings.pre_due_days,
          on_due: updatedSettings.on_due,
          post_due_days: updatedSettings.post_due_days,
          send_hour: updatedSettings.send_hour,
          template_pre_due: updatedSettings.template_pre_due,
          template_on_due: updatedSettings.template_on_due,
          template_post_due: updatedSettings.template_post_due,
          on_due_times: updatedSettings.on_due_times,
          on_due_interval_hours: updatedSettings.on_due_interval_hours,
          max_attempts_per_notification: updatedSettings.max_attempts_per_notification,
          retry_interval_hours: updatedSettings.retry_interval_hours,
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedSettings.id);

      if (error) {
        throw error;
      }

      // Update local state
      setSettings(updatedSettings);

      toast({
        title: "Sucesso",
        description: "Configurações de notificação salvas com sucesso!"
      });
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar configurações",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const triggerNotificationsNow = async () => {
    try {
      setTriggering(true);
      
      console.log('🚀 Disparando notificações às 9:00...');
      
      const { data, error } = await supabase.functions.invoke('billing-notifications', {
        body: { 
          force: true,
          trigger: 'manual_9am_start',
          scheduled_time: '09:00'
        }
      });

      if (error) {
        throw error;
      }

      console.log('✅ Resultado do disparo:', data);
      
      toast({
        title: "Disparos Iniciados!",
        description: `${data?.result?.sent || 0} notificações enviadas, ${data?.result?.created || 0} criadas.`,
      });
    } catch (error: any) {
      console.error('❌ Erro ao disparar notificações:', error);
      toast({
        title: "Erro", 
        description: error.message || "Erro ao iniciar disparos de notificação",
        variant: "destructive"
      });
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Erro ao carregar configurações</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notificações de Cobrança</h2>
          <p className="text-muted-foreground">
            Configure o envio automatizado de notificações via WhatsApp
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={triggerNotificationsNow}
              disabled={triggering || !settings.active}
              className="flex items-center gap-2"
            >
              {triggering ? (
                <Clock className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Disparar 9h
            </Button>
            <BillingNotificationsModal 
              settings={settings}
              onSave={saveSettings}
              saving={saving}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab(
                activeTab === "settings" ? "status" :
                activeTab === "status" ? "history" : "settings"
              )}
            >
              <History className="h-4 w-4 mr-2" />
              {activeTab === "settings" ? "Status" : 
               activeTab === "status" ? "Histórico" : "Configurações"}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.active}
              onCheckedChange={(checked) => {
                const updatedSettings = { ...settings, active: checked };
                setSettings(updatedSettings);
                saveSettings(updatedSettings);
              }}
            />
            <Label>Ativo</Label>
          </div>
        </div>
      </div>

      {activeTab === "history" ? (
        <NotificationHistory />
      ) : activeTab === "status" ? (
        <NotificationSystemStatus />
      ) : (
        <div className="space-y-6">
          {/* Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Antes do Vencimento
                </CardTitle>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{settings.pre_due_days.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {settings.pre_due_days.length > 0 
                    ? `${settings.pre_due_days.join(', ')} dias antes`
                    : 'Nenhum configurado'
                  }
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  No Vencimento
                </CardTitle>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                  <Bell className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {settings.on_due ? settings.on_due_times : '0'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {settings.on_due 
                    ? `${settings.on_due_times}x a cada ${settings.on_due_interval_hours}h`
                    : 'Inativo'
                  }
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Após Vencimento
                </CardTitle>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{settings.post_due_days.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {settings.post_due_days.length > 0 
                    ? `${settings.post_due_days.join(', ')} dias depois`
                    : 'Nenhum configurado'
                  }
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Horário de Envio
                </CardTitle>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {settings.send_hour.substring(0, 5)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Todos os dias</p>
              </CardContent>
            </Card>
          </div>

          {/* Configuration Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Configuração de Timing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <Label className="text-sm font-medium">Dias antes do vencimento</Label>
                  </div>
                  <div className="pl-4">
                    <p className="text-sm text-muted-foreground">
                      {settings.pre_due_days.length > 0 
                        ? settings.pre_due_days.join(', ') + ' dias'
                        : 'Nenhum configurado'
                      }
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <Label className="text-sm font-medium">Enviar no dia do vencimento</Label>
                  </div>
                  <div className="pl-4">
                    <p className="text-sm text-muted-foreground">
                      {settings.on_due 
                        ? `${settings.on_due_times} disparos a cada ${settings.on_due_interval_hours}h`
                        : 'Desativado'
                      }
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <Label className="text-sm font-medium">Dias após o vencimento</Label>
                  </div>
                  <div className="pl-4">
                    <p className="text-sm text-muted-foreground">
                      {settings.post_due_days.length > 0 
                        ? settings.post_due_days.join(', ') + ' dias'
                        : 'Nenhum configurado'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}