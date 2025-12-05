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
import { Settings, MessageSquare, Plus, X, Clock, Play, Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [triggering, setTriggering] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'preview'>('config');
  const { toast } = useToast();

  // Preview helper function
  const renderPreview = (template: string) => {
    const sampleData = {
      cliente: 'João Silva',
      valor: 'R$ 150,00',
      dias: '3',
      vencimento: '15/12/2025',
      link_pagamento: 'https://exemplo.com/pagar/abc123',
      empresa: 'Sua Empresa'
    };
    
    return template
      .replace(/\{\{cliente\}\}/g, sampleData.cliente)
      .replace(/\{\{valor\}\}/g, sampleData.valor)
      .replace(/\{\{dias\}\}/g, sampleData.dias)
      .replace(/\{\{vencimento\}\}/g, sampleData.vencimento)
      .replace(/\{\{link_pagamento\}\}/g, sampleData.link_pagamento)
      .replace(/\{\{empresa\}\}/g, sampleData.empresa);
  };

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

  const triggerNotificationsNow = async () => {
    try {
      setTriggering(true);
      
      console.log('🚀 Disparando notificações manualmente...');
      
      // Chama a função de billing-notifications com force=true
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

                  {/* Botões rápidos - Opções Recomendadas */}
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

                  {/* Configurações de múltiplos disparos pós-vencimento */}
                  {localSettings.post_due_days.length > 0 && (
                    <div className="space-y-3">
                      <div className="ml-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-800">
                          <strong>💡 Sistema Automático:</strong> As notificações pós-vencimento continuarão sendo enviadas 
                          automaticamente todos os dias até o pagamento ser liquidado.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Botões rápidos - Opções Recomendadas */}
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
                    Botão 9h dispara as notificações imediatamente
                  </p>
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
                Personalize as mensagens que serão enviadas aos clientes. Use *texto* para negrito no WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'config' | 'preview')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="config" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Editar
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Preview
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="space-y-6 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="template_pre_due">📋 Mensagem antes do vencimento</Label>
                    <Textarea
                      id="template_pre_due"
                      value={localSettings.template_pre_due}
                      onChange={(e) => setLocalSettings({ ...localSettings, template_pre_due: e.target.value })}
                      rows={6}
                      className="font-mono text-sm"
                    />
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20" onClick={() => setLocalSettings({ ...localSettings, template_pre_due: localSettings.template_pre_due + '{{cliente}}' })}>{"{{cliente}}"}</Badge>
                      <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20" onClick={() => setLocalSettings({ ...localSettings, template_pre_due: localSettings.template_pre_due + '{{valor}}' })}>{"{{valor}}"}</Badge>
                      <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20" onClick={() => setLocalSettings({ ...localSettings, template_pre_due: localSettings.template_pre_due + '{{dias}}' })}>{"{{dias}}"}</Badge>
                      <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20" onClick={() => setLocalSettings({ ...localSettings, template_pre_due: localSettings.template_pre_due + '{{vencimento}}' })}>{"{{vencimento}}"}</Badge>
                      <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20" onClick={() => setLocalSettings({ ...localSettings, template_pre_due: localSettings.template_pre_due + '{{link_pagamento}}' })}>{"{{link_pagamento}}"}</Badge>
                      <Badge variant="outline" className="cursor-pointer hover:bg-primary/20 border-green-500 text-green-600" onClick={() => setLocalSettings({ ...localSettings, template_pre_due: localSettings.template_pre_due + '{{empresa}}' })}>{"{{empresa}}"}</Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="template_on_due">⚠️ Mensagem no vencimento</Label>
                    <Textarea
                      id="template_on_due"
                      value={localSettings.template_on_due}
                      onChange={(e) => setLocalSettings({ ...localSettings, template_on_due: e.target.value })}
                      rows={6}
                      className="font-mono text-sm"
                    />
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20" onClick={() => setLocalSettings({ ...localSettings, template_on_due: localSettings.template_on_due + '{{cliente}}' })}>{"{{cliente}}"}</Badge>
                      <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20" onClick={() => setLocalSettings({ ...localSettings, template_on_due: localSettings.template_on_due + '{{valor}}' })}>{"{{valor}}"}</Badge>
                      <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20" onClick={() => setLocalSettings({ ...localSettings, template_on_due: localSettings.template_on_due + '{{vencimento}}' })}>{"{{vencimento}}"}</Badge>
                      <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20" onClick={() => setLocalSettings({ ...localSettings, template_on_due: localSettings.template_on_due + '{{link_pagamento}}' })}>{"{{link_pagamento}}"}</Badge>
                      <Badge variant="outline" className="cursor-pointer hover:bg-primary/20 border-green-500 text-green-600" onClick={() => setLocalSettings({ ...localSettings, template_on_due: localSettings.template_on_due + '{{empresa}}' })}>{"{{empresa}}"}</Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="template_post_due">🔴 Mensagem após vencimento</Label>
                    <Textarea
                      id="template_post_due"
                      value={localSettings.template_post_due}
                      onChange={(e) => setLocalSettings({ ...localSettings, template_post_due: e.target.value })}
                      rows={6}
                      className="font-mono text-sm"
                    />
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20" onClick={() => setLocalSettings({ ...localSettings, template_post_due: localSettings.template_post_due + '{{cliente}}' })}>{"{{cliente}}"}</Badge>
                      <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20" onClick={() => setLocalSettings({ ...localSettings, template_post_due: localSettings.template_post_due + '{{valor}}' })}>{"{{valor}}"}</Badge>
                      <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20" onClick={() => setLocalSettings({ ...localSettings, template_post_due: localSettings.template_post_due + '{{dias}}' })}>{"{{dias}}"}</Badge>
                      <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20" onClick={() => setLocalSettings({ ...localSettings, template_post_due: localSettings.template_post_due + '{{vencimento}}' })}>{"{{vencimento}}"}</Badge>
                      <Badge variant="secondary" className="cursor-pointer hover:bg-primary/20" onClick={() => setLocalSettings({ ...localSettings, template_post_due: localSettings.template_post_due + '{{link_pagamento}}' })}>{"{{link_pagamento}}"}</Badge>
                      <Badge variant="outline" className="cursor-pointer hover:bg-primary/20 border-green-500 text-green-600" onClick={() => setLocalSettings({ ...localSettings, template_post_due: localSettings.template_post_due + '{{empresa}}' })}>{"{{empresa}}"}</Badge>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="space-y-6 mt-4">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        📋 Preview: Antes do Vencimento
                      </Label>
                      <div className="bg-[#dcf8c6] rounded-lg p-3 text-sm whitespace-pre-wrap shadow-sm border border-green-200 max-w-md">
                        {renderPreview(localSettings.template_pre_due)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        ⚠️ Preview: No Vencimento
                      </Label>
                      <div className="bg-[#dcf8c6] rounded-lg p-3 text-sm whitespace-pre-wrap shadow-sm border border-green-200 max-w-md">
                        {renderPreview(localSettings.template_on_due)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        🔴 Preview: Após Vencimento
                      </Label>
                      <div className="bg-[#dcf8c6] rounded-lg p-3 text-sm whitespace-pre-wrap shadow-sm border border-green-200 max-w-md">
                        {renderPreview(localSettings.template_post_due)}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      💡 <strong>Dica:</strong> Use *texto* para negrito e _texto_ para itálico no WhatsApp.
                      O preview mostra como a mensagem ficará com dados de exemplo.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
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