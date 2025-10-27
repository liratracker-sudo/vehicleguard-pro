import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, QrCode, Barcode, Loader2 } from "lucide-react";

interface PaymentMethod {
  key: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  { 
    key: "pix", 
    label: "PIX", 
    icon: <QrCode className="h-8 w-8" />,
    description: "Pagamento instantâneo via QR Code"
  },
  { 
    key: "boleto", 
    label: "Boleto Bancário", 
    icon: <Barcode className="h-8 w-8" />,
    description: "Código de barras para pagamento em bancos"
  },
  { 
    key: "credit_card", 
    label: "Cartão de Crédito", 
    icon: <CreditCard className="h-8 w-8" />,
    description: "Pagamento com cartão de crédito"
  },
];

export default function PaymentSelection() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [transaction, setTransaction] = useState<any>(null);
  const [availableMethods, setAvailableMethods] = useState<string[]>([]);

  useEffect(() => {
    if (transactionId) {
      loadTransaction();
    }
  }, [transactionId]);

  const loadTransaction = async () => {
    try {
      // Buscar transação
      const { data: txData, error: txError } = await supabase
        .from("payment_transactions")
        .select(`
          *,
          client:clients(*),
          company:companies(*)
        `)
        .eq("id", transactionId)
        .single();

      if (txError || !txData) {
        throw new Error("Transação não encontrada");
      }

      setTransaction(txData);

      // Buscar métodos disponíveis para essa empresa
      const { data: methods, error: methodsError } = await supabase
        .from("payment_gateway_methods")
        .select("payment_method")
        .eq("company_id", txData.company_id)
        .eq("is_active", true);

      if (methodsError) throw methodsError;

      const uniqueMethods = [...new Set(methods?.map(m => m.payment_method) || [])];
      setAvailableMethods(uniqueMethods);
    } catch (error: any) {
      console.error("Error loading transaction:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível carregar a transação",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleMethodSelect = async (method: string) => {
    if (!transactionId) return;
    setProcessing(true);

    try {
      // Buscar gateway configurado para esse método
      const { data: gatewayConfig } = await supabase
        .from("payment_gateway_methods")
        .select("gateway_type")
        .eq("company_id", transaction.company_id)
        .eq("payment_method", method)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!gatewayConfig) {
        throw new Error("Nenhum gateway configurado para este método");
      }

      // Aqui você chamaria a edge function específica do gateway
      // Por exemplo: asaas-integration, mercadopago-integration, etc.
      toast({
        title: "Processando pagamento",
        description: `Gerando cobrança via ${gatewayConfig.gateway_type}...`,
      });

      // TODO: Implementar chamada para edge function do gateway específico
      // const { data, error } = await supabase.functions.invoke(`${gatewayConfig.gateway_type}-integration`, {
      //   body: { action: 'create_charge', transactionId, method }
      // });

    } catch (error: any) {
      console.error("Error processing payment:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível processar o pagamento",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6">
          <p className="text-muted-foreground">Transação não encontrada</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Escolha a forma de pagamento</h1>
          <p className="text-muted-foreground">
            Valor: R$ {transaction.amount?.toFixed(2)}
          </p>
          {transaction.client && (
            <p className="text-sm text-muted-foreground">
              Cliente: {transaction.client.name}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PAYMENT_METHODS.filter(method => availableMethods.includes(method.key)).map((method) => (
            <Card 
              key={method.key}
              className="p-6 hover:border-primary transition-colors cursor-pointer"
              onClick={() => !processing && handleMethodSelect(method.key)}
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-primary/10 rounded-full text-primary">
                  {method.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{method.label}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {method.description}
                  </p>
                </div>
                <Button 
                  className="w-full" 
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    "Selecionar"
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {availableMethods.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">
              Nenhum método de pagamento disponível no momento
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
