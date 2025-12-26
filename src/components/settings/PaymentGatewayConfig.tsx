import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, QrCode, Barcode, Wallet } from "lucide-react";
import { GatewayCard } from "@/components/ui/gateway-card";

interface GatewayConfig {
  gateway: string;
  name: string;
  icon: React.ReactNode;
  color: string;
}

const GATEWAYS: GatewayConfig[] = [
  { gateway: "asaas", name: "Asaas", icon: <Wallet className="h-5 w-5" />, color: "bg-blue-500" },
  { gateway: "mercadopago", name: "Mercado Pago", icon: <Wallet className="h-5 w-5" />, color: "bg-sky-500" },
  { gateway: "gerencianet", name: "Gerencianet", icon: <Wallet className="h-5 w-5" />, color: "bg-orange-500" },
  { gateway: "inter", name: "Banco Inter", icon: <Wallet className="h-5 w-5" />, color: "bg-orange-600" },
];

const PAYMENT_METHODS = [
  { key: "pix", label: "PIX", icon: <QrCode className="h-4 w-4" /> },
  { key: "boleto", label: "Boleto", icon: <Barcode className="h-4 w-4" /> },
  { key: "credit_card", label: "Cartão Crédito", icon: <CreditCard className="h-4 w-4" /> },
  { key: "debit_card", label: "Cartão Débito", icon: <CreditCard className="h-4 w-4" /> },
];

export function PaymentGatewayConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    loadCompanyId();
  }, []);

  useEffect(() => {
    if (companyId) {
      loadConfigs();
    }
  }, [companyId]);

  const loadCompanyId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      setCompanyId(profile.company_id);
    }
  };

  const loadConfigs = async () => {
    if (!companyId) return;

    const { data, error } = await supabase
      .from("payment_gateway_methods")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true);

    if (error) {
      console.error("Error loading configs:", error);
      return;
    }

    const newConfigs: Record<string, Set<string>> = {};
    data?.forEach((config) => {
      if (!newConfigs[config.gateway_type]) {
        newConfigs[config.gateway_type] = new Set();
      }
      newConfigs[config.gateway_type].add(config.payment_method);
    });

    setConfigs(newConfigs);
  };

  const toggleMethod = async (gateway: string, method: string) => {
    if (!companyId) return;
    setLoading(true);

    try {
      const isCurrentlyActive = configs[gateway]?.has(method);

      if (isCurrentlyActive) {
        await supabase
          .from("payment_gateway_methods")
          .delete()
          .eq("company_id", companyId)
          .eq("gateway_type", gateway)
          .eq("payment_method", method);
      } else {
        await supabase
          .from("payment_gateway_methods")
          .insert({
            company_id: companyId,
            gateway_type: gateway,
            payment_method: method,
            is_active: true,
          });
      }

      await loadConfigs();
      
      toast({
        title: isCurrentlyActive ? "Método desativado" : "Método ativado",
        description: `${gateway} ${isCurrentlyActive ? "não usará mais" : "agora usará"} ${method}`,
      });
    } catch (error) {
      console.error("Error toggling method:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível atualizar a configuração",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Configuração de Métodos de Pagamento</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Selecione quais métodos de pagamento cada gateway processará
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GATEWAYS.map((gw) => (
          <GatewayCard
            key={gw.gateway}
            name={gw.name}
            icon={gw.icon}
            iconBgColor={gw.color}
            activeCount={configs[gw.gateway]?.size || 0}
            totalCount={PAYMENT_METHODS.length}
          >
            {PAYMENT_METHODS.map((method) => (
              <div 
                key={method.key} 
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-muted-foreground">{method.icon}</span>
                  <Label htmlFor={`${gw.gateway}-${method.key}`} className="cursor-pointer text-sm">
                    {method.label}
                  </Label>
                </div>
                <Switch
                  id={`${gw.gateway}-${method.key}`}
                  checked={configs[gw.gateway]?.has(method.key) || false}
                  onCheckedChange={() => toggleMethod(gw.gateway, method.key)}
                  disabled={loading}
                />
              </div>
            ))}
          </GatewayCard>
        ))}
      </div>
    </div>
  );
}
