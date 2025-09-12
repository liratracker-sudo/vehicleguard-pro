import { useState } from "react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, MessageSquare, Plus, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

interface BillingNotificationsModalProps {
  settings: NotificationSettings;
  onSave: (settings: NotificationSettings) => void;
  saving: boolean;
}

export function BillingNotificationsModal({ settings, onSave, saving }: BillingNotificationsModalProps) {
  console.log('🚀 BillingNotificationsModal renderizando - NOVA VERSÃO');
  const [localSettings, setLocalSettings] = useState<NotificationSettings>(settings);
  const [open, setOpen] = useState(false);
  const [newPreDay, setNewPreDay] = useState('');
  const [newPostDay, setNewPostDay] = useState('');

  // Sync settings when modal opens
  React.useEffect(() => {
    console.log('🔄 Sincronizando configurações:', settings);
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
          <DialogTitle>🔧 Configurações Detalhadas de Notificação (NOVA VERSÃO)</DialogTitle>
          <DialogDescription>
            Configure quando e como as notificações devem ser enviadas aos clientes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
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
                  
                  {/* Tags dos dias selecionados */}
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

                  {/* Botões rápidos */}
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Adicionar rapidamente:</div>
                    <div className="flex flex-wrap gap-1">
                      {[1, 2, 3, 5, 7, 10, 15].map((day) => (
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

                  {/* Campo para adicionar dias customizados */}
                  <div className="flex gap-2">
                    <Input
                      type="number"
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
                  
                  {localSettings.on_due && (
                    <div className="grid grid-cols-2 gap-2 ml-6">
                      <div>
                        <Label htmlFor="on_due_times">Qtd. disparos</Label>
                        <Input
                          id="on_due_times"
                          type="number"
                          min="1"
                          max="10"
                          value={localSettings.on_due_times}
                          onChange={(e) => {
                            const value = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                            setLocalSettings({ ...localSettings, on_due_times: value });
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="on_due_interval_hours">Intervalo (h)</Label>
                        <Input
                          id="on_due_interval_hours"
                          type="number"
                          min="1"
                          max="12"
                          value={localSettings.on_due_interval_hours}
                          onChange={(e) => {
                            const value = Math.max(1, Math.min(12, parseInt(e.target.value) || 2));
                            setLocalSettings({ ...localSettings, on_due_interval_hours: value });
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>Dias após o vencimento</Label>
                  
                  {/* Tags dos dias selecionados */}
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

                  {/* Botões rápidos */}
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Adicionar rapidamente:</div>
                    <div className="flex flex-wrap gap-1">
                      {[1, 2, 3, 5, 7, 10, 15].map((day) => (
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

                  {/* Campo para adicionar dias customizados */}
                  <div className="flex gap-2">
                    <Input
                      type="number"
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
                  <Input
                    id="send_hour"
                    type="time"
                    value={localSettings.send_hour}
                    onChange={(e) => setLocalSettings({ ...localSettings, send_hour: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="max_attempts">Máx. tentativas</Label>
                  <Input
                    id="max_attempts"
                    type="number"
                    min="1"
                    max="10"
                    value={localSettings.max_attempts_per_notification}
                    onChange={(e) => {
                      const value = Math.max(1, Math.min(10, parseInt(e.target.value) || 3));
                      setLocalSettings({ ...localSettings, max_attempts_per_notification: value });
                    }}
                  />
                </div>
                
                <div>
                  <Label htmlFor="retry_interval">Intervalo nova tentativa (h)</Label>
                  <Input
                    id="retry_interval"
                    type="number"
                    min="1"
                    max="24"
                    value={localSettings.retry_interval_hours}
                    onChange={(e) => {
                      const value = Math.max(1, Math.min(24, parseInt(e.target.value) || 1));
                      setLocalSettings({ ...localSettings, retry_interval_hours: value });
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
                  value={localSettings.template_pre_due}
                  onChange={(e) => setLocalSettings({ ...localSettings, template_pre_due: e.target.value })}
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
                  value={localSettings.template_on_due}
                  onChange={(e) => setLocalSettings({ ...localSettings, template_on_due: e.target.value })}
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
                  value={localSettings.template_post_due}
                  onChange={(e) => setLocalSettings({ ...localSettings, template_post_due: e.target.value })}
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