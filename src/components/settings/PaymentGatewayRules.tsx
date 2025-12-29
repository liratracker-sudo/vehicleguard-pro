import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { usePaymentGatewayRules, CreateRuleData } from "@/hooks/usePaymentGatewayRules";
import { Plus, Pencil, Trash2, Filter, Loader2 } from "lucide-react";

const GATEWAYS = [
  { id: 'asaas', name: 'Asaas' },
  { id: 'mercadopago', name: 'Mercado Pago' },
  { id: 'inter', name: 'Banco Inter' },
  { id: 'gerencianet', name: 'Efi (Gerencianet)' },
];

const PAYMENT_METHODS = [
  { id: 'pix', name: 'PIX' },
  { id: 'boleto', name: 'Boleto' },
  { id: 'credit_card', name: 'Cartão de Crédito' },
];

interface RuleFormProps {
  initialData?: CreateRuleData;
  onSubmit: (data: CreateRuleData) => Promise<boolean>;
  onCancel: () => void;
  loading?: boolean;
}

function RuleForm({ initialData, onSubmit, onCancel, loading }: RuleFormProps) {
  const [formData, setFormData] = useState<CreateRuleData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    min_amount: initialData?.min_amount || 0,
    max_amount: initialData?.max_amount,
    allowed_gateways: initialData?.allowed_gateways || [],
    allowed_methods: initialData?.allowed_methods || [],
    priority: initialData?.priority || 1,
    is_active: initialData?.is_active ?? true,
  });

  const toggleGateway = (gatewayId: string) => {
    setFormData(prev => ({
      ...prev,
      allowed_gateways: prev.allowed_gateways.includes(gatewayId)
        ? prev.allowed_gateways.filter(g => g !== gatewayId)
        : [...prev.allowed_gateways, gatewayId]
    }));
  };

  const toggleMethod = (methodId: string) => {
    setFormData(prev => ({
      ...prev,
      allowed_methods: prev.allowed_methods.includes(methodId)
        ? prev.allowed_methods.filter(m => m !== methodId)
        : [...prev.allowed_methods, methodId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onSubmit(formData);
    if (success) onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome da Regra *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Ex: Alto valor - Apenas Asaas"
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Descrição</Label>
        <Input
          id="description"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descrição opcional da regra"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="min_amount">Valor Mínimo (R$)</Label>
          <Input
            id="min_amount"
            type="number"
            step="0.01"
            min="0"
            value={formData.min_amount}
            onChange={(e) => setFormData({ ...formData, min_amount: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label htmlFor="max_amount">Valor Máximo (R$)</Label>
          <Input
            id="max_amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Sem limite"
            value={formData.max_amount || ''}
            onChange={(e) => setFormData({ ...formData, max_amount: e.target.value ? parseFloat(e.target.value) : undefined })}
          />
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Gateways Permitidos *</Label>
        <div className="flex flex-wrap gap-3">
          {GATEWAYS.map(gateway => (
            <div key={gateway.id} className="flex items-center space-x-2">
              <Checkbox
                id={`gateway-${gateway.id}`}
                checked={formData.allowed_gateways.includes(gateway.id)}
                onCheckedChange={() => toggleGateway(gateway.id)}
              />
              <label htmlFor={`gateway-${gateway.id}`} className="text-sm cursor-pointer">
                {gateway.name}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Métodos de Pagamento Permitidos</Label>
        <p className="text-xs text-muted-foreground mb-2">Deixe vazio para permitir todos os métodos</p>
        <div className="flex flex-wrap gap-3">
          {PAYMENT_METHODS.map(method => (
            <div key={method.id} className="flex items-center space-x-2">
              <Checkbox
                id={`method-${method.id}`}
                checked={formData.allowed_methods.includes(method.id)}
                onCheckedChange={() => toggleMethod(method.id)}
              />
              <label htmlFor={`method-${method.id}`} className="text-sm cursor-pointer">
                {method.name}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="priority">Prioridade</Label>
        <Input
          id="priority"
          type="number"
          min="1"
          value={formData.priority}
          onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
        />
        <p className="text-xs text-muted-foreground mt-1">Menor número = maior prioridade</p>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
        <Label htmlFor="is_active">Regra ativa</Label>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={loading || !formData.name || formData.allowed_gateways.length === 0}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Salvar
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function PaymentGatewayRules() {
  const { rules, loading, createRule, updateRule, deleteRule, toggleRule } = usePaymentGatewayRules();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<typeof rules[0] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (data: CreateRuleData) => {
    setSubmitting(true);
    const success = await createRule(data);
    setSubmitting(false);
    if (success) setDialogOpen(false);
    return success;
  };

  const handleUpdate = async (data: CreateRuleData) => {
    if (!editingRule) return false;
    setSubmitting(true);
    const success = await updateRule(editingRule.id, data);
    setSubmitting(false);
    if (success) setEditingRule(null);
    return success;
  };

  const getGatewayName = (id: string) => GATEWAYS.find(g => g.id === id)?.name || id;
  const getMethodName = (id: string) => PAYMENT_METHODS.find(m => m.id === id)?.name || id;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Regras de Gateway por Valor
            </CardTitle>
            <CardDescription>
              Defina quais gateways e métodos de pagamento ficam disponíveis baseado no valor da cobrança
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nova Regra
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova Regra de Gateway</DialogTitle>
                <DialogDescription>
                  Configure as condições e restrições de pagamento
                </DialogDescription>
              </DialogHeader>
              <RuleForm
                onSubmit={handleCreate}
                onCancel={() => setDialogOpen(false)}
                loading={submitting}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Filter className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma regra configurada</p>
            <p className="text-sm mt-1">Crie uma regra para restringir gateways por valor da cobrança</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map(rule => (
              <div
                key={rule.id}
                className={`border rounded-lg p-4 ${!rule.is_active ? 'opacity-60 bg-muted/30' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{rule.name}</span>
                      <Badge variant={rule.is_active ? 'default' : 'secondary'} className="text-xs">
                        {rule.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Prioridade: {rule.priority}
                      </Badge>
                    </div>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
                    )}
                    <div className="text-sm space-y-1">
                      <p>
                        <span className="text-muted-foreground">Valores:</span>{' '}
                        R$ {rule.min_amount.toFixed(2)}
                        {rule.max_amount ? ` até R$ ${rule.max_amount.toFixed(2)}` : ' ou mais'}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Gateways:</span>{' '}
                        {rule.allowed_gateways.map(getGatewayName).join(', ')}
                      </p>
                      {rule.allowed_methods.length > 0 && (
                        <p>
                          <span className="text-muted-foreground">Métodos:</span>{' '}
                          {rule.allowed_methods.map(getMethodName).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                    />
                    <Dialog open={editingRule?.id === rule.id} onOpenChange={(open) => !open && setEditingRule(null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setEditingRule(rule)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Editar Regra</DialogTitle>
                          <DialogDescription>
                            Altere as configurações da regra
                          </DialogDescription>
                        </DialogHeader>
                        <RuleForm
                          initialData={editingRule || undefined}
                          onSubmit={handleUpdate}
                          onCancel={() => setEditingRule(null)}
                          loading={submitting}
                        />
                      </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A regra "{rule.name}" será removida permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteRule(rule.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
