import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useManualPixSettings } from "@/hooks/useManualPixSettings";
import { QrCode, Save, Loader2 } from "lucide-react";

export function ManualPixSettings() {
  const { settings, setSettings, loading, saving, save } = useManualPixSettings();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-4 w-4" /> PIX Manual (chave direta)
        </CardTitle>
        <CardDescription>
          Quando nenhum gateway estiver ativo, o checkout exibe sua chave PIX com desconto antes do vencimento e acréscimo após. A confirmação do pagamento é feita manualmente pelo admin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm">Ativar PIX Manual</Label>
            <p className="text-xs text-muted-foreground">Exibe a chave no checkout público.</p>
          </div>
          <Switch
            checked={settings.is_active}
            onCheckedChange={(v) => setSettings({ ...settings, is_active: v })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Tipo de chave</Label>
            <Select
              value={settings.pix_key_type}
              onValueChange={(v) => setSettings({ ...settings, pix_key_type: v as any })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
                <SelectItem value="aleatoria">Aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Chave PIX</Label>
            <Input
              value={settings.pix_key}
              onChange={(e) => setSettings({ ...settings, pix_key: e.target.value })}
              placeholder="Cole sua chave PIX"
            />
          </div>
        </div>

        <div>
          <Label>Nome do beneficiário</Label>
          <Input
            value={settings.beneficiary_name}
            onChange={(e) => setSettings({ ...settings, beneficiary_name: e.target.value })}
            placeholder="Nome que aparece ao cliente"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border p-3 space-y-3">
            <Label className="text-sm font-semibold">Desconto (até o vencimento)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={settings.discount_type}
                onValueChange={(v) => setSettings({ ...settings, discount_type: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={settings.discount_value}
                onChange={(e) => setSettings({ ...settings, discount_value: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <Label className="text-sm font-semibold">Acréscimo (após vencimento)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={settings.surcharge_type}
                onValueChange={(v) => setSettings({ ...settings, surcharge_type: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={settings.surcharge_value}
                onChange={(e) => setSettings({ ...settings, surcharge_value: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>

        <div>
          <Label>Instruções (opcional)</Label>
          <Textarea
            value={settings.instructions || ''}
            onChange={(e) => setSettings({ ...settings, instructions: e.target.value })}
            placeholder="Ex: Após o pagamento, envie o comprovante no WhatsApp..."
            rows={3}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={() => save(settings)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
