import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Bot, ChevronDown, Loader2, MoreVertical, Play, Plus, X, FileText } from "lucide-react";
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
  const [systemPrompt, setSystemPrompt] = useState("Você é um assistente de comunicação de cobrança para um SaaS. Sua prioridade é a recuperação financeira mantendo um relacionamento cordial com o cliente. Siga as instruções fornecidas no prompt do usuário para gerar mensagens personalizadas e adequadas ao contexto.");
  
  const [reportActive, setReportActive] = useState(false);
  const [managerPhones, setManagerPhones] = useState<string[]>([""]);
  const [scheduleDay, setScheduleDay] = useState("1");
  const [scheduleTime, setScheduleTime] = useState("09:00");

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

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

  const handleSaveAll = async () => {
    const validPhones = managerPhones.filter(phone => phone.trim() !== "");
    
    await Promise.all([
      saveSettings({
        is_active: isActive,
        openai_model: model,
        system_prompt: systemPrompt
      }),
      saveWeeklyReport({
        is_active: reportActive,
        manager_phones: validPhones,
        schedule_day: parseInt(scheduleDay),
        schedule_time: scheduleTime
      })
    ]);
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
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Configurações de IA
          </CardTitle>
          <CardDescription>
            Configure a IA para cobranças automáticas e relatórios
          </CardDescription>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem 
              onClick={processOverdueClients}
              disabled={processing || !isActive}
            >
              <Play className="w-4 h-4 mr-2" />
              Processar Inadimplentes
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={generateWeeklyReport}
              disabled={processing || !reportActive}
            >
              <FileText className="w-4 h-4 mr-2" />
              Testar Relatório
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Seção Principal - Sempre Visível */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ativar IA de Cobrança</Label>
              <p className="text-sm text-muted-foreground">
                Substitui mensagens padronizadas por textos dinâmicos
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
                <SelectItem value="gpt-4o-mini">GPT-4o Mini (Rápido)</SelectItem>
                <SelectItem value="gpt-4o">GPT-4o (Poderoso)</SelectItem>
                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Configurações Avançadas - Colapsável */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
              <span className="text-sm font-medium">Configurações Avançadas</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            <Label htmlFor="systemPrompt">Prompt do Sistema</Label>
            <Textarea
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Prompt para a IA..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Tom adapta automaticamente: 1-7 dias (cordial), 8-30 dias (profissional), 30+ dias (formal)
            </p>
          </CollapsibleContent>
        </Collapsible>

        {/* Relatórios Semanais - Colapsável */}
        <Collapsible open={reportsOpen} onOpenChange={setReportsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
              <span className="text-sm font-medium">Relatórios Semanais</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${reportsOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Ativar Relatórios</Label>
                <p className="text-sm text-muted-foreground">
                  Envio automático via WhatsApp
                </p>
              </div>
              <Switch checked={reportActive} onCheckedChange={setReportActive} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Telefones dos Gestores</Label>
                {managerPhones.length < 6 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addManagerPhone}
                    className="h-7 text-xs"
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduleDay">Dia</Label>
                <Select value={scheduleDay} onValueChange={setScheduleDay}>
                  <SelectTrigger id="scheduleDay">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Segunda</SelectItem>
                    <SelectItem value="2">Terça</SelectItem>
                    <SelectItem value="3">Quarta</SelectItem>
                    <SelectItem value="4">Quinta</SelectItem>
                    <SelectItem value="5">Sexta</SelectItem>
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
          </CollapsibleContent>
        </Collapsible>

        {/* Botão Único de Salvar */}
        <Button onClick={handleSaveAll} disabled={processing} className="w-full">
          {processing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar Configurações"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
