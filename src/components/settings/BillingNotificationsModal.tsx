import { useState } from "react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, X, Clock, Play, AlertTriangle, AlertCircle, AlertOctagon, Ban, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { preventWheelChange } from "@/lib/no-wheel";

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
  // Escalation fields
  template_post_due_warning: string;
  template_post_due_urgent: string;
  template_post_due_final: string;
  template_suspended: string;
  auto_suspension_enabled: boolean;
  suspension_after_days: number;
}

interface BillingNotificationsModalProps {
  settings: NotificationSettings;
  onSave: (settings: NotificationSettings) => void;
  saving: boolean;
}

const DEFAULT_TEMPLATES = {
  warning: `🟡 *Aviso de Atraso*

Olá *{{cliente}}*!

Sua fatura de *{{valor}}* está com *{{dias}} dias de atraso* (vencimento: {{vencimento}}).

⚠️ Regularize para evitar a suspensão do serviço.

💳 Pague agora:
{{link_pagamento}}

_{{empresa}}_`,
  urgent: `🟠 *AVISO URGENTE*

*{{cliente}}*, sua conta está com *{{dias}} dias de atraso*!

Valor: *{{valor}}*
Vencimento: {{vencimento}}

⚠️ *Seu serviço será SUSPENSO em breve se não regularizar.*

💳 Pague AGORA:
{{link_pagamento}}

_{{empresa}}_`,
  final: `🔴 *ÚLTIMO AVISO*

*{{cliente}}*, seu serviço será *SUSPENSO EM 24H*!

Pagamento de *{{valor}}* com *{{dias}} dias de atraso*.

⛔ Esta é sua última chance de evitar a suspensão.

💳 Regularize IMEDIATAMENTE:
{{link_pagamento}}

_{{empresa}}_`,
  suspended: `⛔ *SERVIÇO SUSPENSO*

*{{cliente}}*, seu serviço foi *SUSPENSO* por inadimplência.

Valor em aberto: *{{valor}}*
Dias de atraso: *{{dias}}*

Para reativar seu serviço, quite seu débito:
{{link_pagamento}}

_{{empresa}}_`
};

export function BillingNotificationsModal({ settings, onSave, saving }: BillingNotificationsModalProps) {
  const [localSettings, setLocalSettings] = useState<NotificationSettings>(settings);
  const [open, setOpen] = useState(false);
  const [newPreDay, setNewPreDay] = useState('');
  const [newPostDay, setNewPostDay] = useState('');
  const [triggering, setTriggering] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings, open]);

  const addPreDueDay = () => {
    const day = parseInt(newPreDay);
    if (!isNaN(day) && day > 0 && day <= 30 && !localSettings.pre_due_days.includes(day)) {
      const updatedDays = [...localSettings.pre_due_days, day].sort((a, b) => a - b);
      setLocalSettings({ ...localSettings, pre_due_days: updatedDays });
      setNewPreDay('');
    }
  };

  const removePreDueDay = (dayToRemove: number) => {
    const updatedDays = localSettings.pre_due_days.filter(day => day !== dayToRemove);
    setLocalSettings({ ...localSettings, pre_due_days: updatedDays });
  };

  const addPostDueDay = () => {
    const day = parseInt(newPostDay);
    if (!isNaN(day) && day > 0 && day <= 30 && !localSettings.post_due_days.includes(day)) {
      const updatedDays = [...localSettings.post_due_days, day].sort((a, b) => a - b);
      setLocalSettings({ ...localSettings, post_due_days: updatedDays });
      setNewPostDay('');
    }
  };

  const removePostDueDay = (dayToRemove: number) => {
    const updatedDays = localSettings.post_due_days.filter(day => day !== dayToRemove);
    setLocalSettings({ ...localSettings, post_due_days: updatedDays });
  };

  const addQuickDay = (days: number[], type: 'pre' | 'post', day: number) => {
    if (type === 'pre') {
      if (!localSettings.pre_due_days.includes(day)) {
        const updatedDays = [...localSettings.pre_due_days, day].sort((a, b) => a - b);
        setLocalSettings({ ...localSettings, pre_due_days: updatedDays });
      }
    } else {
      if (!localSettings.post_due_days.includes(day)) {
        const updatedDays = [...localSettings.post_due_days, day].sort((a, b) => a - b);
        setLocalSettings({ ...localSettings, post_due_days: updatedDays });
      }
    }
  };

  const handleSave = () => {
    onSave(localSettings);
    setOpen(false);
  };

  const triggerNotificationsNow = async () => {
    try {
      setTriggering(true);
      
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
      
      toast({
        title: "Sucesso",
        description: `Disparos iniciados! ${data?.result?.sent || 0} enviadas, ${data?.result?.created || 0} criadas.`,
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

  const resetTemplate = (type: 'warning' | 'urgent' | 'final' | 'suspended') => {
    const fieldMap = {
      warning: 'template_post_due_warning',
      urgent: 'template_post_due_urgent',
      final: 'template_post_due_final',
      suspended: 'template_suspended'
    };
    setLocalSettings({
      ...localSettings,
      [fieldMap[type]]: DEFAULT_TEMPLATES[type]
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Configurações
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações de Notificação</DialogTitle>
          <DialogDescription>
            Configure quando e como as notificações devem ser enviadas aos clientes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Timing Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuração de Timing
              </CardTitle>
              <CardDescription>
                Defina quando as notificações devem ser enviadas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-3">
                  <Label>Dias antes do vencimento</Label>
                  
                  <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-2 border rounded-md bg-muted/30">
                    {localSettings.pre_due_days.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Nenhum dia configurado</span>
                    ) : (
                      localSettings.pre_due_days.map((day) => (
                        <Badge key={day} variant="secondary" className="gap-1">
                          {day} dia{day > 1 ? 's' : ''}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-auto p-0 w-4 h-4 hover:bg-destructive/20"
                            onClick={() => removePreDueDay(day)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-foreground">⚡ Opções Recomendadas:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {[1, 3, 5, 7, 10].map((day) => (
                        <Button
                          key={day}
                          size="sm"
                          variant={localSettings.pre_due_days.includes(day) ? "secondary" : "default"}
                          className="h-7 px-3 text-xs font-medium"
                          disabled={localSettings.pre_due_days.includes(day)}
                          onClick={() => addQuickDay(localSettings.pre_due_days, 'pre', day)}
                        >
                          {day} {day === 1 ? 'dia' : 'dias'}
                        </Button>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">Outras opções:</div>
                    <div className="flex flex-wrap gap-1">
                      {[2, 15, 20, 30].map((day) => (
                        <Button
                          key={day}
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          disabled={localSettings.pre_due_days.includes(day)}
                          onClick={() => addQuickDay(localSettings.pre_due_days, 'pre', day)}
                        >
                          {day}d
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      type="number"
                    onWheel={preventWheelChange}
                      min="1"
                      max="30"
                      placeholder="Dias"
                      value={newPreDay}
                      onChange={(e) => setNewPreDay(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addPreDueDay()}
                      className="flex-1"
                    />
                    <Button size="sm" onClick={addPreDueDay} disabled={!newPreDay}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="on_due"
                      checked={localSettings.on_due}
                      onCheckedChange={(checked) => setLocalSettings({ ...localSettings, on_due: checked })}
                    />
                    <Label htmlFor="on_due">Enviar no dia do vencimento</Label>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Dias após o vencimento</Label>
                  
                  <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-2 border rounded-md bg-muted/30">
                    {localSettings.post_due_days.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Nenhum dia configurado</span>
                    ) : (
                      localSettings.post_due_days.map((day) => (
                        <Badge key={day} variant="secondary" className="gap-1">
                          {day} dia{day > 1 ? 's' : ''}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-auto p-0 w-4 h-4 hover:bg-destructive/20"
                            onClick={() => removePostDueDay(day)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-foreground">⚡ Opções Recomendadas:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {[1, 3, 5, 7, 10].map((day) => (
                        <Button
                          key={day}
                          size="sm"
                          variant={localSettings.post_due_days.includes(day) ? "secondary" : "default"}
                          className="h-7 px-3 text-xs font-medium"
                          disabled={localSettings.post_due_days.includes(day)}
                          onClick={() => addQuickDay(localSettings.post_due_days, 'post', day)}
                        >
                          {day} {day === 1 ? 'dia' : 'dias'}
                        </Button>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">Outras opções:</div>
                    <div className="flex flex-wrap gap-1">
                      {[2, 15, 20, 30].map((day) => (
                        <Button
                          key={day}
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          disabled={localSettings.post_due_days.includes(day)}
                          onClick={() => addQuickDay(localSettings.post_due_days, 'post', day)}
                        >
                          {day}d
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      type="number"
                    onWheel={preventWheelChange}
                      min="1"
                      max="30"
                      placeholder="Dias"
                      value={newPostDay}
                      onChange={(e) => setNewPostDay(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addPostDueDay()}
                      className="flex-1"
                    />
                    <Button size="sm" onClick={addPostDueDay} disabled={!newPostDay}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="send_hour">Horário de envio</Label>
                  <div className="flex gap-2">
                    <Input
                      id="send_hour"
                      type="time"
                      value={localSettings.send_hour}
                      onChange={(e) => setLocalSettings({ ...localSettings, send_hour: e.target.value })}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={triggerNotificationsNow}
                      disabled={triggering}
                      className="flex items-center gap-1 px-3"
                      title="Disparar notificações agora (9:00)"
                    >
                      {triggering ? (
                        <Clock className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      9h
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Dispara apenas notificações atrasadas (já agendadas)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Escalation Configuration Card */}
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                Escalada de Inadimplência
              </CardTitle>
              <CardDescription>
                Configure a escalada automática para clientes inadimplentes e suspensão de serviço
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Auto Suspension Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Ban className="h-4 w-4 text-destructive" />
                    <Label className="text-base font-medium">Suspensão Automática de Serviço</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Suspender automaticamente o serviço de clientes inadimplentes
                  </p>
                </div>
                <Switch
                  checked={localSettings.auto_suspension_enabled}
                  onCheckedChange={(checked) => setLocalSettings({ ...localSettings, auto_suspension_enabled: checked })}
                />
              </div>

              {localSettings.auto_suspension_enabled && (
                <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <Label>Suspender após</Label>
                  <Input
                    type="number"
                    onWheel={preventWheelChange}
                    min="7"
                    max="90"
                    value={localSettings.suspension_after_days}
                    onChange={(e) => setLocalSettings({ ...localSettings, suspension_after_days: parseInt(e.target.value) || 21 })}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">dias de atraso</span>
                </div>
              )}

              <Separator />

              {/* Escalation Levels */}
              <div className="space-y-1">
                <h4 className="font-medium">Níveis de Escalada</h4>
                <p className="text-sm text-muted-foreground">
                  Personalize as mensagens enviadas em cada nível de atraso. 
                  Variáveis disponíveis: <code className="text-xs bg-muted px-1 rounded">{"{{cliente}}"}</code>, <code className="text-xs bg-muted px-1 rounded">{"{{valor}}"}</code>, <code className="text-xs bg-muted px-1 rounded">{"{{dias}}"}</code>, <code className="text-xs bg-muted px-1 rounded">{"{{vencimento}}"}</code>, <code className="text-xs bg-muted px-1 rounded">{"{{link_pagamento}}"}</code>, <code className="text-xs bg-muted px-1 rounded">{"{{empresa}}"}</code>
                </p>
              </div>

              {/* Warning Level (6-10 days) */}
              <div className="space-y-2 p-4 border rounded-lg border-yellow-500/30 bg-yellow-500/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <Label className="font-medium text-yellow-700">Aviso (6-10 dias)</Label>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-500/50">Nível 1</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => resetTemplate('warning')}
                    className="text-xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restaurar
                  </Button>
                </div>
                <Textarea
                  value={localSettings.template_post_due_warning || DEFAULT_TEMPLATES.warning}
                  onChange={(e) => setLocalSettings({ ...localSettings, template_post_due_warning: e.target.value })}
                  rows={6}
                  className="text-sm"
                />
              </div>

              {/* Urgent Level (11-15 days) */}
              <div className="space-y-2 p-4 border rounded-lg border-orange-500/30 bg-orange-500/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <Label className="font-medium text-orange-700">Urgente (11-15 dias)</Label>
                    <Badge variant="outline" className="text-orange-600 border-orange-500/50">Nível 2</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => resetTemplate('urgent')}
                    className="text-xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restaurar
                  </Button>
                </div>
                <Textarea
                  value={localSettings.template_post_due_urgent || DEFAULT_TEMPLATES.urgent}
                  onChange={(e) => setLocalSettings({ ...localSettings, template_post_due_urgent: e.target.value })}
                  rows={6}
                  className="text-sm"
                />
              </div>

              {/* Final Level (16-20 days) */}
              <div className="space-y-2 p-4 border rounded-lg border-red-500/30 bg-red-500/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertOctagon className="h-4 w-4 text-red-600" />
                    <Label className="font-medium text-red-700">Final (16-20 dias)</Label>
                    <Badge variant="outline" className="text-red-600 border-red-500/50">Nível 3</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => resetTemplate('final')}
                    className="text-xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restaurar
                  </Button>
                </div>
                <Textarea
                  value={localSettings.template_post_due_final || DEFAULT_TEMPLATES.final}
                  onChange={(e) => setLocalSettings({ ...localSettings, template_post_due_final: e.target.value })}
                  rows={6}
                  className="text-sm"
                />
              </div>

              {/* Suspended Level (21+ days) */}
              <div className="space-y-2 p-4 border rounded-lg border-destructive/30 bg-destructive/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ban className="h-4 w-4 text-destructive" />
                    <Label className="font-medium text-destructive">Suspensão ({localSettings.suspension_after_days || 21}+ dias)</Label>
                    <Badge variant="destructive">Final</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => resetTemplate('suspended')}
                    className="text-xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restaurar
                  </Button>
                </div>
                <Textarea
                  value={localSettings.template_suspended || DEFAULT_TEMPLATES.suspended}
                  onChange={(e) => setLocalSettings({ ...localSettings, template_suspended: e.target.value })}
                  rows={6}
                  className="text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}