import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Calendar, Play, Loader2, Plus, X } from "lucide-react";
import { useAICollection } from "@/hooks/useAICollection";

export function AICollectionSettings() {
  const {
    settings,
    weeklyReport,
    loading,
    processing,
    saveSettings,
    saveWeeklyReport,
    processOverdueClients,
    generateWeeklyReport
  } = useAICollection();

  const [isActive, setIsActive] = useState(false);
  const [model, setModel] = useState("gpt-4o-mini");
  const [systemPrompt, setSystemPrompt] = useState("");
  
  const [reportActive, setReportActive] = useState(false);
  const [managerPhones, setManagerPhones] = useState<string[]>([""]);
  const [scheduleDay, setScheduleDay] = useState("1");
  const [scheduleTime, setScheduleTime] = useState("09:00");

  useEffect(() => {
    if (settings) {
      setIsActive(settings.is_active);
      setModel(settings.openai_model);
      setSystemPrompt(settings.system_prompt);
    }
  }, [settings]);

  useEffect(() => {
    if (weeklyReport) {
      setReportActive(weeklyReport.is_active);
      setManagerPhones(
        weeklyReport.manager_phones && weeklyReport.manager_phones.length > 0
          ? weeklyReport.manager_phones
          : [""]
      );
      setScheduleDay(weeklyReport.schedule_day.toString());
      setScheduleTime(weeklyReport.schedule_time);
    }
  }, [weeklyReport]);

  const handleSaveSettings = async () => {
    await saveSettings({
      is_active: isActive,
      openai_model: model,
      system_prompt: systemPrompt
    });
  };

  const handleSaveReport = async () => {
    const validPhones = managerPhones.filter(phone => phone.trim() !== "");
    
    await saveWeeklyReport({
      is_active: reportActive,
      manager_phones: validPhones,
      schedule_day: parseInt(scheduleDay),
      schedule_time: scheduleTime
    });
  };

  const addManagerPhone = () => {
    if (managerPhones.length < 6) {
      setManagerPhones([...managerPhones, ""]);
    }
  };

  const removeManagerPhone = (index: number) => {
    if (managerPhones.length > 1) {
      setManagerPhones(managerPhones.filter((_, i) => i !== index));
    }
  };

  const updateManagerPhone = (index: number, value: string) => {
    const newPhones = [...managerPhones];
    newPhones[index] = value;
    setManagerPhones(newPhones);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Configurações de IA
          </CardTitle>
          <CardDescription>
            Configure a inteligência artificial para gerar mensagens personalizadas de cobrança
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ativar IA de Cobrança</Label>
              <p className="text-sm text-muted-foreground">
                Use IA para gerar mensagens personalizadas
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Modelo OpenAI</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o-mini">GPT-4o Mini (Rápido e Econômico)</SelectItem>
                <SelectItem value="gpt-4o">GPT-4o (Mais Poderoso)</SelectItem>
                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="systemPrompt">Prompt do Sistema</Label>
            <Textarea
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Você é um assistente de cobrança profissional e educado da empresa Lira Tracker. Gere mensagens personalizadas de cobrança considerando o histórico e situação do cliente. Sempre termine as mensagens com 'Atenciosamente, Lira Tracker' sem incluir nome de atendente."
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              Define como a IA deve se comportar ao gerar mensagens
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveSettings} disabled={processing}>
              Salvar Configurações
            </Button>
            <Button
              variant="outline"
              onClick={processOverdueClients}
              disabled={processing || !isActive}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Processar Inadimplentes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Relatório Semanal Automático
          </CardTitle>
          <CardDescription>
            Configure o envio automático de relatórios semanais via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ativar Relatórios Semanais</Label>
              <p className="text-sm text-muted-foreground">
                Envie relatórios automáticos para o gestor
              </p>
            </div>
            <Switch checked={reportActive} onCheckedChange={setReportActive} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Telefones dos Gestores (máx. 6)</Label>
              {managerPhones.length < 6 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addManagerPhone}
                  className="h-8"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Adicionar
                </Button>
              )}
            </div>
            
            {managerPhones.map((phone, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={phone}
                  onChange={(e) => updateManagerPhone(index, e.target.value)}
                  placeholder="5511999999999"
                  className="flex-1"
                />
                {managerPhones.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeManagerPhone(index)}
                    className="h-9 w-9 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            
            <p className="text-xs text-muted-foreground">
              Números com código do país (ex: 5511999999999). Todos os gestores receberão relatórios e poderão interagir com o assistente de IA.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduleDay">Dia da Semana</Label>
              <Select value={scheduleDay} onValueChange={setScheduleDay}>
                <SelectTrigger id="scheduleDay">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Segunda-feira</SelectItem>
                  <SelectItem value="2">Terça-feira</SelectItem>
                  <SelectItem value="3">Quarta-feira</SelectItem>
                  <SelectItem value="4">Quinta-feira</SelectItem>
                  <SelectItem value="5">Sexta-feira</SelectItem>
                  <SelectItem value="6">Sábado</SelectItem>
                  <SelectItem value="0">Domingo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduleTime">Horário</Label>
              <Input
                id="scheduleTime"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveReport} disabled={processing}>
              Salvar Relatórios
            </Button>
            <Button
              variant="outline"
              onClick={generateWeeklyReport}
              disabled={processing || !reportActive}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Testar Relatório
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}