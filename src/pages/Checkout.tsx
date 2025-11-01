import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { QrCode, Receipt, CreditCard, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface PaymentData {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  company_id: string;
  client: {
    name: string;
    email?: string;
    phone?: string;
    document?: string;
  };
  company: {
    name: string;
    logo_url?: string;
  };
}

interface PaymentMethod {
  key: string;
  label: string;
  icon: React.ReactNode;
  gateway: string;
}

export default function Checkout() {
  const { payment_id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [availableMethods, setAvailableMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{
    success: boolean;
    payment_url?: string;
    pix_code?: string;
    barcode?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (payment_id) {
      loadPaymentData();
    }
  }, [payment_id]);

  const loadPaymentData = async () => {
    try {
      setLoading(true);

      // Buscar dados do pagamento (acesso público via RPC ou política RLS relaxada)
      const { data: paymentData, error: paymentError } = await supabase
        .from('payment_transactions')
        .select(`
          id,
          amount,
          due_date,
          status,
          company_id,
          clients!inner(name, email, phone, document),
          companies!inner(name, logo_url)
        `)
        .eq('id', payment_id)
        .single();

      if (paymentError) throw paymentError;

      if (!paymentData) {
        throw new Error('Pagamento não encontrado');
      }

      // Verificar se já foi pago
      if (paymentData.status === 'paid') {
        setPaymentResult({ success: true });
        return;
      }

      if (paymentData.status === 'cancelled') {
        setPaymentResult({ success: false, error: 'Pagamento cancelado' });
        return;
      }

      setPayment({
        id: paymentData.id,
        amount: paymentData.amount,
        due_date: paymentData.due_date,
        status: paymentData.status,
        company_id: paymentData.company_id,
        client: {
          name: paymentData.clients.name,
          email: paymentData.clients.email,
          phone: paymentData.clients.phone,
          document: paymentData.clients.document,
        },
        company: {
          name: paymentData.companies.name,
          logo_url: paymentData.companies.logo_url,
        }
      });

      // Buscar métodos de pagamento disponíveis
      const { data: methods, error: methodsError } = await supabase
        .from('payment_gateway_methods')
        .select('payment_method, gateway_type')
        .eq('company_id', paymentData.company_id)
        .eq('is_active', true);

      if (methodsError) throw methodsError;

      // Mapear para formato de UI
      const methodsMap: Record<string, PaymentMethod> = {
        'pix': { key: 'pix', label: 'PIX', icon: <QrCode className="h-5 w-5" />, gateway: '' },
        'boleto': { key: 'boleto', label: 'Boleto', icon: <Receipt className="h-5 w-5" />, gateway: '' },
        'credit_card': { key: 'credit_card', label: 'Cartão de Crédito', icon: <CreditCard className="h-5 w-5" />, gateway: '' },
        'debit_card': { key: 'debit_card', label: 'Cartão de Débito', icon: <CreditCard className="h-5 w-5" />, gateway: '' },
      };

      const available = methods?.map(m => ({
        ...methodsMap[m.payment_method],
        gateway: m.gateway_type
      })).filter(m => m.key) || [];

      setAvailableMethods(available);

    } catch (error) {
      console.error('Error loading payment:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao carregar dados do pagamento",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const processPayment = async () => {
    if (!selectedMethod || !payment) {
      console.log('Missing data:', { selectedMethod, payment });
      return;
    }

    console.log('Starting payment process:', {
      payment_id: payment.id,
      payment_method: selectedMethod,
      company_id: payment.company_id
    });

    setProcessing(true);

    try {
      // Chamar edge function para processar pagamento
      console.log('Invoking process-checkout function...');
      
      const { data, error } = await supabase.functions.invoke('process-checkout', {
        body: {
          payment_id: payment.id,
          payment_method: selectedMethod,
          client_data: payment.client
        }
      });

      console.log('Function response:', { data, error });

      if (error) {
        console.error('Function error:', error);
        throw error;
      }

      if (!data) {
        console.error('No data received from function');
        throw new Error('Nenhuma resposta recebida do servidor');
      }

      if (!data.success) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error || 'Erro ao processar pagamento');
      }

      console.log('Payment processed successfully:', data);

      setPaymentResult({
        success: true,
        payment_url: data.payment_url,
        pix_code: data.pix_code,
        barcode: data.barcode
      });

      toast({
        title: "Pagamento processado",
        description: "Redirecionando para finalização..."
      });

      // Redirecionar para URL de pagamento se disponível
      if (data.payment_url) {
        setTimeout(() => {
          window.location.href = data.payment_url;
        }, 2000);
      }

    } catch (error) {
      console.error('Error processing payment:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error)
          : "Erro ao processar pagamento";
      
      toast({
        title: "Erro ao processar pagamento",
        description: errorMessage,
        variant: "destructive"
      });
      
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (paymentResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            {paymentResult.success ? (
              <>
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <CardTitle>Pagamento Confirmado</CardTitle>
                <CardDescription>Seu pagamento foi processado com sucesso</CardDescription>
              </>
            ) : (
              <>
                <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                <CardTitle>Pagamento Indisponível</CardTitle>
                <CardDescription>{paymentResult.error}</CardDescription>
              </>
            )}
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <CardTitle>Pagamento não encontrado</CardTitle>
            <CardDescription>O link de pagamento é inválido ou expirou</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            {payment.company.logo_url && (
              <img 
                src={payment.company.logo_url} 
                alt={payment.company.name}
                className="h-16 mx-auto mb-4 object-contain"
              />
            )}
            <CardTitle className="text-2xl">{payment.company.name}</CardTitle>
            <CardDescription>Pagamento seguro e rápido</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Detalhes do pagamento */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-medium">{payment.client.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Vencimento:</span>
                <span className="font-medium">
                  {format(new Date(payment.due_date), 'dd/MM/yyyy')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={payment.status === 'overdue' ? 'destructive' : 'secondary'}>
                  {payment.status === 'pending' ? 'Pendente' : 'Vencido'}
                </Badge>
              </div>
              <Separator />
              <div className="flex justify-between items-center pt-2">
                <span className="text-lg font-semibold">Valor:</span>
                <span className="text-2xl font-bold text-primary">
                  R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <Separator />

            {/* Seleção de método de pagamento */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Escolha a forma de pagamento</h3>
              
              {availableMethods.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum método de pagamento disponível no momento.</p>
                  <p className="text-sm mt-2">Entre em contato com {payment.company.name}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {availableMethods.map((method) => (
                    <Button
                      key={method.key}
                      variant={selectedMethod === method.key ? "default" : "outline"}
                      className="h-auto py-4 px-6 justify-start"
                      onClick={() => setSelectedMethod(method.key)}
                    >
                      <div className="flex items-center gap-3">
                        {method.icon}
                        <div className="text-left">
                          <div className="font-semibold">{method.label}</div>
                          <div className="text-xs opacity-70">
                            via {method.gateway}
                          </div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Botão de pagamento */}
            {availableMethods.length > 0 && (
              <Button
                size="lg"
                className="w-full"
                disabled={!selectedMethod || processing}
                onClick={processPayment}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Continuar para pagamento'
                )}
              </Button>
            )}

            {/* Informações de segurança */}
            <div className="text-center text-xs text-muted-foreground">
              <p>🔒 Pagamento seguro e criptografado</p>
              <p>Seus dados estão protegidos</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
