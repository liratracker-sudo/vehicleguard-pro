import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useExpenseNotificationSettings } from "@/hooks/useExpenseNotificationSettings"
import { Bell, Clock, FileText, History, Save, Loader2 } from "lucide-react"
import { format } from "date-fns"

const PRE_DUE_OPTIONS = [7, 5, 3, 2, 1]
const POST_DUE_OPTIONS = [1, 3, 5, 7, 15, 30]

export function ExpenseNotifications() {
  const { settings, isLoading, saveSettings, logs, logsLoading } = useExpenseNotificationSettings()
  
  const [isActive, setIsActive] = useState(true)
  const [preDueDays, setPreDueDays] = useState<number[]>([3, 1])
  const [notifyOnDue, setNotifyOnDue] = useState(true)
  const [postDueDays, setPostDueDays] = useState<number[]>([1, 3, 7])
  const [sendHour, setSendHour] = useState("08:00")
  const [sendDailySummary, setSendDailySummary] = useState(true)
  const [templatePreDue, setTemplatePreDue] = useState("")
  const [templateOnDue, setTemplateOnDue] = useState("")
  const [templatePostDue, setTemplatePostDue] = useState("")

  // Load settings when data arrives
  useEffect(() => {
    if (settings) {
      setIsActive(settings.is_active ?? true)
      setPreDueDays(settings.pre_due_days ?? [3, 1])
      setNotifyOnDue(settings.notify_on_due ?? true)
      setPostDueDays(settings.post_due_days ?? [1, 3, 7])
      setSendHour(settings.send_hour ?? "08:00")
      setSendDailySummary(settings.send_daily_summary ?? true)
      setTemplatePreDue(settings.template_pre_due ?? "")
      setTemplateOnDue(settings.template_on_due ?? "")
      setTemplatePostDue(settings.template_post_due ?? "")
    }
  }, [settings])

  const handlePreDueChange = (day: number, checked: boolean) => {
    if (checked) {
      setPreDueDays([...preDueDays, day].sort((a, b) => b - a))
    } else {
      setPreDueDays(preDueDays.filter(d => d !== day))
    }
  }

  const handlePostDueChange = (day: number, checked: boolean) => {
    if (checked) {
      setPostDueDays([...postDueDays, day].sort((a, b) => a - b))
    } else {
      setPostDueDays(postDueDays.filter(d => d !== day))
    }
  }

  const handleSave = () => {
    saveSettings.mutate({
      is_active: isActive,
      pre_due_days: preDueDays,
      notify_on_due: notifyOnDue,
      post_due_days: postDueDays,
      send_hour: sendHour,
      send_daily_summary: sendDailySummary,
      template_pre_due: templatePreDue,
      template_on_due: templateOnDue,
      template_post_due: templatePostDue
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle>Notificações de Despesas</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="active-toggle">Ativo</Label>
              <Switch
                id="active-toggle"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>
          <CardDescription>
            Configure alertas automáticos para despesas próximas do vencimento ou vencidas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Horário de envio */}
          <div className="flex items-center gap-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <Label>Horário de envio</Label>
              <p className="text-sm text-muted-foreground">Horário para envio das notificações diárias</p>
            </div>
            <Input
              type="time"
              value={sendHour}
              onChange={(e) => setSendHour(e.target.value)}
              className="w-32"
            />
          </div>

          <Separator />

          {/* Resumo diário */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Resumo Diário</Label>
              <p className="text-sm text-muted-foreground">
                Envia um resumo consolidado das despesas pendentes
              </p>
            </div>
            <Switch
              checked={sendDailySummary}
              onCheckedChange={setSendDailySummary}
            />
          </div>

          <Separator />

          {/* Dias antes do vencimento */}
          <div className="space-y-3">
            <div>
              <Label>Notificar antes do vencimento</Label>
              <p className="text-sm text-muted-foreground">
                Selecione quantos dias antes do vencimento deseja receber alertas
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {PRE_DUE_OPTIONS.map(day => (
                <label key={`pre-${day}`} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={preDueDays.includes(day)}
                    onCheckedChange={(checked) => handlePreDueChange(day, !!checked)}
                  />
                  <span className="text-sm">{day} dia{day > 1 ? 's' : ''}</span>
                </label>
              ))}
            </div>
          </div>

          {/* No dia do vencimento */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Notificar no dia do vencimento</Label>
              <p className="text-sm text-muted-foreground">
                Enviar alerta no dia em que a despesa vence
              </p>
            </div>
            <Switch
              checked={notifyOnDue}
              onCheckedChange={setNotifyOnDue}
            />
          </div>

          <Separator />

          {/* Dias após o vencimento */}
          <div className="space-y-3">
            <div>
              <Label>Notificar após o vencimento</Label>
              <p className="text-sm text-muted-foreground">
                Selecione quantos dias após o vencimento deseja receber alertas de atraso
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {POST_DUE_OPTIONS.map(day => (
                <label key={`post-${day}`} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={postDueDays.includes(day)}
                    onCheckedChange={(checked) => handlePostDueChange(day, !!checked)}
                  />
                  <span className="text-sm">{day} dia{day > 1 ? 's' : ''}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4">
            <Button onClick={handleSave} disabled={saveSettings.isPending}>
              {saveSettings.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Templates de mensagem */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Templates de Mensagem</CardTitle>
          </div>
          <CardDescription>
            Personalize as mensagens enviadas. Use as variáveis: {`{{descricao}}`}, {`{{valor}}`}, {`{{dias}}`}, {`{{vencimento}}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Mensagem para despesas a vencer</Label>
            <Textarea
              value={templatePreDue}
              onChange={(e) => setTemplatePreDue(e.target.value)}
              rows={4}
              placeholder="⚠️ *Conta a Vencer*&#10;&#10;📋 {{descricao}}&#10;💰 Valor: R$ {{valor}}&#10;📅 Vence em: {{dias}} dia(s)"
            />
          </div>

          <div className="space-y-2">
            <Label>Mensagem para despesas vencendo hoje</Label>
            <Textarea
              value={templateOnDue}
              onChange={(e) => setTemplateOnDue(e.target.value)}
              rows={4}
              placeholder="🔔 *Conta Vence Hoje!*&#10;&#10;📋 {{descricao}}&#10;💰 Valor: R$ {{valor}}"
            />
          </div>

          <div className="space-y-2">
            <Label>Mensagem para despesas vencidas</Label>
            <Textarea
              value={templatePostDue}
              onChange={(e) => setTemplatePostDue(e.target.value)}
              rows={4}
              placeholder="🚨 *Conta Vencida*&#10;&#10;📋 {{descricao}}&#10;💰 Valor: R$ {{valor}}&#10;⏰ Vencida há: {{dias}} dia(s)"
            />
          </div>

          <Button onClick={handleSave} disabled={saveSettings.isPending}>
            {saveSettings.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Templates
          </Button>
        </CardContent>
      </Card>

      {/* Histórico de notificações */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <CardTitle>Histórico de Notificações</CardTitle>
          </div>
          <CardDescription>
            Últimas notificações de despesas enviadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {logs.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        log.status === 'sent' ? 'default' :
                        log.status === 'failed' ? 'destructive' : 'secondary'
                      }>
                        {log.status === 'sent' ? 'Enviado' :
                         log.status === 'failed' ? 'Falhou' : 'Pendente'}
                      </Badge>
                      <Badge variant="outline">
                        {log.notification_type === 'pre_due' ? 'A vencer' :
                         log.notification_type === 'on_due' ? 'Vence hoje' :
                         log.notification_type === 'post_due' ? 'Vencido' : 'Resumo'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {log.recipient_name || log.recipient_phone}
                      </span>
                    </div>
                    <p className="text-sm mt-1 line-clamp-1">{log.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(log.created_at), "dd/MM HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma notificação enviada ainda
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
