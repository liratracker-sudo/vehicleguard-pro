import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Percent, DollarSign, AlertTriangle } from "lucide-react";

interface LateFeeSettingsData {
  id?: string;
  company_id: string;
  is_active: boolean;
  fine_enabled: boolean;
  fine_type: string;
  fine_value: number;
  interest_enabled: boolean;
  interest_type: string;
  interest_value: number;
  grace_days: number;
}

export function LateFeeSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<LateFeeSettingsData | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) return;

      const { data, error } = await supabase
        .from('company_late_fee_settings')
        .select('*')
        .eq('company_id', profile.company_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
      } else {
        // Criar configuração padrão
        setSettings({
          company_id: profile.company_id,
          is_active: true,
          fine_enabled: true,
          fine_type: 'PERCENTAGE',
          fine_value: 2.00,
          interest_enabled: true,
          interest_type: 'PERCENTAGE',
          interest_value: 0.033,
          grace_days: 0
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações de multa",
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

      const dataToSave = {
        company_id: settings.company_id,
        is_active: settings.is_active,
        fine_enabled: settings.fine_enabled,
        fine_type: settings.fine_type,
        fine_value: settings.fine_value,
        interest_enabled: settings.interest_enabled,
        interest_type: settings.interest_type,
        interest_value: settings.interest_value,
        grace_days: settings.grace_days
      };

      if (settings.id) {
        const { error } = await supabase
          .from('company_late_fee_settings')
          .update(dataToSave)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('company_late_fee_settings')
          .insert(dataToSave)
          .select()
          .single();

        if (error) throw error;
        setSettings(data);
      }

      toast({
        title: "Salvo",
        description: "Configurações de multa/juros atualizadas"
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!settings) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Multa e Juros por Atraso
            </CardTitle>
            <CardDescription>
              Configure multa e juros automáticos para cobranças em atraso
            </CardDescription>
          </div>
          <Switch
            checked={settings.is_active}
            onCheckedChange={(checked) => setSettings({ ...settings, is_active: checked })}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Multa */}
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Multa por Atraso</Label>
              <p className="text-sm text-muted-foreground">
                Aplicada uma única vez após o vencimento
              </p>
            </div>
            <Switch
              checked={settings.fine_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, fine_enabled: checked })}
              disabled={!settings.is_active}
            />
          </div>

          {settings.fine_enabled && settings.is_active && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={settings.fine_type}
                  onValueChange={(value) => setSettings({ ...settings, fine_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4" />
                        Porcentagem
                      </div>
                    </SelectItem>
                    <SelectItem value="FIXED">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Valor Fixo
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {settings.fine_type === 'PERCENTAGE' ? 'Percentual (%)' : 'Valor (R$)'}
                </Label>
                <Input
                  type="number"
                  step={settings.fine_type === 'PERCENTAGE' ? '0.01' : '0.01'}
                  value={settings.fine_value}
                  onChange={(e) => setSettings({ ...settings, fine_value: parseFloat(e.target.value) || 0 })}
                  placeholder={settings.fine_type === 'PERCENTAGE' ? '2.00' : '10.00'}
                />
              </div>
            </div>
          )}
        </div>

        {/* Juros */}
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Juros por Dia</Label>
              <p className="text-sm text-muted-foreground">
                Aplicados por cada dia de atraso (1% ao mês ≈ 0.033% ao dia)
              </p>
            </div>
            <Switch
              checked={settings.interest_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, interest_enabled: checked })}
              disabled={!settings.is_active}
            />
          </div>

          {settings.interest_enabled && settings.is_active && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={settings.interest_type}
                  onValueChange={(value) => setSettings({ ...settings, interest_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4" />
                        Porcentagem/dia
                      </div>
                    </SelectItem>
                    <SelectItem value="FIXED">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Valor Fixo/dia
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {settings.interest_type === 'PERCENTAGE' ? 'Percentual ao dia (%)' : 'Valor por dia (R$)'}
                </Label>
                <Input
                  type="number"
                  step="0.001"
                  value={settings.interest_value}
                  onChange={(e) => setSettings({ ...settings, interest_value: parseFloat(e.target.value) || 0 })}
                  placeholder={settings.interest_type === 'PERCENTAGE' ? '0.033' : '1.00'}
                />
              </div>
            </div>
          )}
        </div>

        {/* Carência */}
        <div className="space-y-2">
          <Label>Dias de Carência</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Dias após o vencimento antes de aplicar multa/juros
          </p>
          <Input
            type="number"
            min="0"
            value={settings.grace_days}
            onChange={(e) => setSettings({ ...settings, grace_days: parseInt(e.target.value) || 0 })}
            disabled={!settings.is_active}
            className="max-w-[120px]"
          />
        </div>

        {/* Preview */}
        {settings.is_active && (
          <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
              Exemplo de cálculo (R$ 100,00 com 10 dias de atraso):
            </p>
            <div className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
              <p>Valor original: R$ 100,00</p>
              {settings.fine_enabled && (
                <p>
                  Multa: R$ {settings.fine_type === 'PERCENTAGE' 
                    ? (100 * settings.fine_value / 100).toFixed(2)
                    : settings.fine_value.toFixed(2)
                  }
                </p>
              )}
              {settings.interest_enabled && (
                <p>
                  Juros (10 dias): R$ {settings.interest_type === 'PERCENTAGE'
                    ? (100 * settings.interest_value / 100 * Math.max(0, 10 - settings.grace_days)).toFixed(2)
                    : (settings.interest_value * Math.max(0, 10 - settings.grace_days)).toFixed(2)
                  }
                </p>
              )}
              <p className="font-medium pt-1 border-t border-orange-300 dark:border-orange-700">
                Total: R$ {(
                  100 +
                  (settings.fine_enabled 
                    ? (settings.fine_type === 'PERCENTAGE' ? 100 * settings.fine_value / 100 : settings.fine_value)
                    : 0) +
                  (settings.interest_enabled
                    ? (settings.interest_type === 'PERCENTAGE'
                        ? 100 * settings.interest_value / 100 * Math.max(0, 10 - settings.grace_days)
                        : settings.interest_value * Math.max(0, 10 - settings.grace_days))
                    : 0)
                ).toFixed(2)}
              </p>
            </div>
          </div>
        )}

        <Button onClick={saveSettings} disabled={saving} className="w-full">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar Configurações
        </Button>
      </CardContent>
    </Card>
  );
}
