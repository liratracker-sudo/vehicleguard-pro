import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bell, Clock, MessageSquare, Users, Calendar, History } from "lucide-react";
import { NotificationHistory } from "@/components/billing/NotificationHistory";
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
  const [activeTab, setActiveTab] = useState<"settings" | "history">("settings");
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

  const saveSettings = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      
      // Validate required fields
      if (settings.pre_due_days.length === 0 && !settings.on_due && settings.post_due_days.length === 0) {
        throw new Error('Configure pelo menos um tipo de notificação');
      }

      if (settings.on_due && (!settings.on_due_times || settings.on_due_times < 1)) {
        throw new Error('Quantidade de disparos deve ser pelo menos 1');
      }

    console.log('Saving notification settings:', {
      active: settings.active,
      pre_due_days: settings.pre_due_days,
      on_due: settings.on_due,
      post_due_days: settings.post_due_days,
      send_hour: settings.send_hour,
      on_due_times: settings.on_due_times,
      on_due_interval_hours: settings.on_due_interval_hours,
      max_attempts_per_notification: settings.max_attempts_per_notification,
      retry_interval_hours: settings.retry_interval_hours
    });

    const { error } = await supabase
        .from('payment_notification_settings')
        .update({
          active: settings.active,
          pre_due_days: settings.pre_due_days,
          on_due: settings.on_due,
          post_due_days: settings.post_due_days,
          send_hour: settings.send_hour,
          template_pre_due: settings.template_pre_due,
          template_on_due: settings.template_on_due,
          template_post_due: settings.template_post_due,
          on_due_times: settings.on_due_times,
          on_due_interval_hours: settings.on_due_interval_hours,
          max_attempts_per_notification: settings.max_attempts_per_notification,
          retry_interval_hours: settings.retry_interval_hours,
          updated_at: new Date().toISOString()
        })
        .eq('id', settings.id);

      if (error) {
        throw error;
      }

      // Reload settings to ensure sync
      await loadSettings();

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

  const handlePreDueDaysChange = (value: string) => {
    if (!settings) return;
    
    console.log('Pre-due input value:', value);
    const days = value.split(',')
      .map(d => parseInt(d.trim()))
      .filter(d => !isNaN(d) && d > 0 && d <= 30)
      .sort((a, b) => a - b);
    
    console.log('Parsed pre-due days:', days);
    setSettings({ ...settings, pre_due_days: days });
  };

  const handlePostDueDaysChange = (value: string) => {
    if (!settings) return;
    
    console.log('Post-due input value:', value);
    const days = value.split(',')
      .map(d => parseInt(d.trim()))
      .filter(d => !isNaN(d) && d > 0 && d <= 30)
      .sort((a, b) => a - b);
    
    console.log('Parsed post-due days:', days);
    setSettings({ ...settings, post_due_days: days });
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notificações de Cobrança</h2>
          <p className="text-muted-foreground">
            Configure o envio automatizado de notificações via WhatsApp
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "settings" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("settings")}
            >
              Configurações
            </Button>
            <Button
              variant={activeTab === "history" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("history")}
            >
              <History className="h-4 w-4 mr-2" />
              Histórico
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.active}
              onCheckedChange={(checked) => setSettings({ ...settings, active: checked })}
            />
            <Label>Ativo</Label>
          </div>
        </div>
      </div>

      {activeTab === "history" ? (
        <NotificationHistory />
      ) : (
        <div className="space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Antes do Vencimento</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{settings.pre_due_days.length}</div>
            <p className="text-xs text-muted-foreground">
              {settings.pre_due_days.join(', ')} dias antes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No Vencimento</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{settings.on_due ? settings.on_due_times : '0'}</div>
            <p className="text-xs text-muted-foreground">
              {settings.on_due ? `${settings.on_due_times}x a cada ${settings.on_due_interval_hours}h` : 'Inativo'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Após Vencimento</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{settings.post_due_days.length}</div>
            <p className="text-xs text-muted-foreground">
              {settings.post_due_days.join(', ')} dias depois
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horário de Envio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{settings.send_hour}</div>
            <p className="text-xs text-muted-foreground">Todos os dias</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Configuração de Timing
          </CardTitle>
          <CardDescription>
            Defina quando as notificações devem ser enviadas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="pre_due_days">Dias antes do vencimento</Label>
              <Input
                id="pre_due_days"
                type="text"
                placeholder="3, 7, 15"
                value={settings.pre_due_days.join(', ')}
                onChange={(e) => handlePreDueDaysChange(e.target.value)}
                onKeyDown={(e) => {
                  // Permitir números, vírgulas, espaços e teclas de navegação
                  const allowedKeys = [
                    'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
                    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'
                  ];
                  const isNumber = e.key >= '0' && e.key <= '9';
                  const isComma = e.key === ',' || e.key === '.';
                  const isSpace = e.key === ' ';
                  
                  if (!allowedKeys.includes(e.key) && !isNumber && !isComma && !isSpace) {
                    e.preventDefault();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Separe os dias por vírgula (ex: 3, 7, 15)
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="on_due"
                  checked={settings.on_due}
                  onCheckedChange={(checked) => setSettings({ ...settings, on_due: checked })}
                />
                <Label htmlFor="on_due">Enviar no dia do vencimento</Label>
              </div>
              
              {settings.on_due && (
                <div className="grid grid-cols-2 gap-2 ml-6">
                  <div>
                    <Label htmlFor="on_due_times">Quantidade de disparos</Label>
                    <Input
                      id="on_due_times"
                      type="number"
                      min="1"
                      max="10"
                      value={settings.on_due_times}
                      onChange={(e) => {
                        const value = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                        setSettings({ ...settings, on_due_times: value });
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="on_due_interval_hours">Intervalo (horas)</Label>
                    <Input
                      id="on_due_interval_hours"
                      type="number"
                      min="1"
                      max="12"
                      value={settings.on_due_interval_hours}
                      onChange={(e) => {
                        const value = Math.max(1, Math.min(12, parseInt(e.target.value) || 2));
                        setSettings({ ...settings, on_due_interval_hours: value });
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="post_due_days">Dias após o vencimento</Label>
              <Input
                id="post_due_days"
                type="text"
                placeholder="2, 5, 10"
                value={settings.post_due_days.join(', ')}
                onChange={(e) => handlePostDueDaysChange(e.target.value)}
                onKeyDown={(e) => {
                  // Permitir números, vírgulas, espaços e teclas de navegação
                  const allowedKeys = [
                    'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
                    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'
                  ];
                  const isNumber = e.key >= '0' && e.key <= '9';
                  const isComma = e.key === ',' || e.key === '.';
                  const isSpace = e.key === ' ';
                  
                  if (!allowedKeys.includes(e.key) && !isNumber && !isComma && !isSpace) {
                    e.preventDefault();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Separe os dias por vírgula (ex: 2, 5, 10)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="send_hour">Horário de envio</Label>
              <Input
                id="send_hour"
                type="time"
                value={settings.send_hour}
                onChange={(e) => setSettings({ ...settings, send_hour: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="max_attempts">Máx. tentativas por notificação</Label>
              <Input
                id="max_attempts"
                type="number"
                min="1"
                max="10"
                value={settings.max_attempts_per_notification}
                onChange={(e) => {
                  const value = Math.max(1, Math.min(10, parseInt(e.target.value) || 3));
                  setSettings({ ...settings, max_attempts_per_notification: value });
                }}
              />
            </div>
            
            <div>
              <Label htmlFor="retry_interval">Intervalo de nova tentativa (h)</Label>
              <Input
                id="retry_interval"
                type="number"
                min="1"
                max="24"
                value={settings.retry_interval_hours}
                onChange={(e) => {
                  const value = Math.max(1, Math.min(24, parseInt(e.target.value) || 1));
                  setSettings({ ...settings, retry_interval_hours: value });
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Templates de Mensagem
          </CardTitle>
          <CardDescription>
            Personalize as mensagens que serão enviadas aos clientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="template_pre_due">Mensagem antes do vencimento</Label>
            <Textarea
              id="template_pre_due"
              value={settings.template_pre_due}
              onChange={(e) => setSettings({ ...settings, template_pre_due: e.target.value })}
              rows={3}
            />
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">{"{{cliente}}"}</Badge>
              <Badge variant="secondary">{"{{valor}}"}</Badge>
              <Badge variant="secondary">{"{{dias}}"}</Badge>
              <Badge variant="secondary">{"{{vencimento}}"}</Badge>
              <Badge variant="secondary">{"{{link_pagamento}}"}</Badge>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="template_on_due">Mensagem no vencimento</Label>
            <Textarea
              id="template_on_due"
              value={settings.template_on_due}
              onChange={(e) => setSettings({ ...settings, template_on_due: e.target.value })}
              rows={3}
            />
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">{"{{cliente}}"}</Badge>
              <Badge variant="secondary">{"{{valor}}"}</Badge>
              <Badge variant="secondary">{"{{vencimento}}"}</Badge>
              <Badge variant="secondary">{"{{link_pagamento}}"}</Badge>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="template_post_due">Mensagem após vencimento</Label>
            <Textarea
              id="template_post_due"
              value={settings.template_post_due}
              onChange={(e) => setSettings({ ...settings, template_post_due: e.target.value })}
              rows={3}
            />
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">{"{{cliente}}"}</Badge>
              <Badge variant="secondary">{"{{valor}}"}</Badge>
              <Badge variant="secondary">{"{{dias}}"}</Badge>
              <Badge variant="secondary">{"{{vencimento}}"}</Badge>
              <Badge variant="secondary">{"{{link_pagamento}}"}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}