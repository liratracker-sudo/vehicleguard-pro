import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, QrCode, Barcode, Loader2, Check, Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import QRCodeLib from 'qrcode';

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
    icon: <QrCode className="h-12 w-12" />,
    description: "Pagamento instantâneo via QR Code - Aprovação imediata"
  },
  { 
    key: "boleto", 
    label: "Boleto Bancário", 
    icon: <Barcode className="h-12 w-12" />,
    description: "Pague em qualquer banco ou lotérica - Vence em até 3 dias"
  },
  { 
    key: "credit_card", 
    label: "Cartão de Crédito", 
    icon: <CreditCard className="h-12 w-12" />,
    description: "Parcele em até 12x - Aprovação instantânea"
  },
];

export default function PaymentSelection() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<any>(null);
  const [availableMethods, setAvailableMethods] = useState<string[]>([]);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [paymentResult, setPaymentResult] = useState<{
    success: boolean;
    payment_url?: string;
    pix_code?: string;
    barcode?: string;
    error?: string;
  } | null>(null);

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
    } finally {
      setLoading(false);
    }
  };

  const handleMethodSelect = async (method: string) => {
    if (!transactionId) return;
    setSelectedMethod(method);
    setProcessing(true);

    try {
      console.log('Processing payment method selection:', method);

      // Call process-checkout edge function
      const { data, error } = await supabase.functions.invoke('process-checkout', {
        body: {
          payment_id: transactionId,
          payment_method: method
        }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao processar pagamento');
      }

      console.log('Payment processed successfully:', data);

      // Gerar QR Code se tiver chave PIX
      if (data.pix_code) {
        try {
          const qrDataUrl = await QRCodeLib.toDataURL(data.pix_code, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          setQrCodeDataUrl(qrDataUrl);
        } catch (qrError) {
          console.error('Error generating QR code:', qrError);
        }
      }

      // Mostrar resultado
      setPaymentResult({
        success: true,
        payment_url: data.payment_url,
        pix_code: data.pix_code,
        barcode: data.barcode
      });

      // Toast de sucesso
      if (method === 'pix') {
        toast({
          title: "PIX gerado com sucesso!",
          description: "Escaneie o QR Code ou copie a chave PIX",
        });
      } else if (method === 'boleto') {
        toast({
          title: "Boleto gerado com sucesso!",
          description: "Use o código de barras para pagar",
        });
      }

    } catch (error: any) {
      console.error("Error processing payment:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível processar o pagamento",
      });
      setSelectedMethod(null);
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

  // Se já processou o pagamento, mostrar resultado
  if (paymentResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <div className="p-8">
            <div className="text-center mb-6">
              {paymentResult.success ? (
                <>
                  <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-2">Pagamento Gerado!</h2>
                  <p className="text-muted-foreground">
                    {paymentResult.pix_code ? 'Escaneie o QR Code ou copie a chave PIX' : 'Complete o pagamento usando as informações abaixo'}
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-2">Erro ao processar</h2>
                  <p className="text-muted-foreground">{paymentResult.error}</p>
                </>
              )}
            </div>

            {paymentResult.success && (
              <div className="space-y-6">
                {/* QR Code PIX */}
                {paymentResult.pix_code && (
                  <div className="space-y-4">
                    {qrCodeDataUrl ? (
                      <div className="bg-white p-4 rounded-lg flex items-center justify-center">
                        <img src={qrCodeDataUrl} alt="QR Code PIX" className="w-64 h-64" />
                      </div>
                    ) : (
                      <div className="bg-white p-4 rounded-lg flex items-center justify-center">
                        <Loader2 className="h-48 w-48 text-gray-400 animate-spin" />
                      </div>
                    )}
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Chave PIX (Pix Copia e Cola)</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={paymentResult.pix_code}
                          readOnly
                          className="flex-1 p-2 border rounded text-sm bg-muted font-mono text-xs"
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(paymentResult.pix_code!);
                            toast({
                              title: "Copiado!",
                              description: "Chave PIX copiada",
                            });
                          }}
                        >
                          Copiar
                        </Button>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg text-sm">
                      <p className="font-medium mb-2">Como pagar:</p>
                      <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                        <li>Abra o app do seu banco</li>
                        <li>Escolha pagar com PIX</li>
                        <li>Escaneie o QR Code ou cole a chave</li>
                        <li>Confirme o pagamento</li>
                      </ol>
                    </div>
                  </div>
                )}

                {/* Boleto */}
                {paymentResult.barcode && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Código de Barras</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={paymentResult.barcode}
                          readOnly
                          className="flex-1 p-2 border rounded text-sm bg-muted font-mono text-xs"
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(paymentResult.barcode!);
                            toast({
                              title: "Copiado!",
                              description: "Código copiado",
                            });
                          }}
                        >
                          Copiar
                        </Button>
                      </div>
                    </div>

                    {paymentResult.payment_url && (
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={() => window.open(paymentResult.payment_url, '_blank')}
                      >
                        <Barcode className="mr-2 h-5 w-5" />
                        Abrir Boleto
                      </Button>
                    )}
                  </div>
                )}

                {/* Cartão de Crédito - Redirect */}
                {!paymentResult.pix_code && !paymentResult.barcode && paymentResult.payment_url && (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => window.open(paymentResult.payment_url, '_blank')}
                  >
                    <CreditCard className="mr-2 h-5 w-5" />
                    Continuar para Pagamento
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-4 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-2">
            <Sparkles className="h-4 w-4" />
            Pagamento Seguro
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Escolha como pagar
          </h1>
          <div className="space-y-1">
            <p className="text-3xl font-bold text-primary">
              R$ {transaction.amount?.toFixed(2)}
            </p>
            {transaction.client && (
              <p className="text-sm text-muted-foreground">
                Pagamento para {transaction.company?.name || 'empresa'}
              </p>
            )}
          </div>
        </div>

        {/* Payment Methods Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {PAYMENT_METHODS.filter(method => availableMethods.includes(method.key)).map((method, index) => {
            const isSelected = selectedMethod === method.key;
            const isProcessing = processing && isSelected;
            
            return (
              <Card 
                key={method.key}
                className={`
                  group relative overflow-hidden transition-all duration-300 cursor-pointer
                  hover:shadow-2xl hover:scale-105 hover:-translate-y-1
                  ${isSelected ? 'ring-2 ring-primary shadow-xl scale-105' : 'hover:border-primary/50'}
                  ${isProcessing ? 'pointer-events-none' : ''}
                `}
                style={{ animationDelay: `${0.2 + index * 0.1}s` }}
                onClick={() => !processing && handleMethodSelect(method.key)}
              >
                {/* Gradient Background Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Content */}
                <div className="relative p-8 flex flex-col items-center text-center space-y-6">
                  {/* Icon Container */}
                  <div className={`
                    relative p-6 rounded-2xl transition-all duration-300
                    ${isSelected 
                      ? 'bg-primary text-primary-foreground shadow-lg' 
                      : 'bg-primary/10 text-primary group-hover:bg-primary/20 group-hover:scale-110'
                    }
                  `}>
                    {isProcessing ? (
                      <Loader2 className="h-12 w-12 animate-spin" />
                    ) : isSelected ? (
                      <Check className="h-12 w-12" />
                    ) : (
                      method.icon
                    )}
                    
                    {/* Pulse Effect */}
                    {isSelected && (
                      <div className="absolute inset-0 rounded-2xl bg-primary animate-ping opacity-20" />
                    )}
                  </div>

                  {/* Text Content */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-xl">
                      {method.label}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {method.description}
                    </p>
                  </div>

                  {/* Action Button */}
                  <Button 
                    className="w-full group-hover:shadow-lg transition-all duration-300" 
                    variant={isSelected ? "default" : "outline"}
                    disabled={processing}
                    size="lg"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : isSelected ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Selecionado
                      </>
                    ) : (
                      "Continuar"
                    )}
                  </Button>
                </div>

                {/* Bottom Border Effect */}
                <div className={`
                  absolute bottom-0 left-0 right-0 h-1 transition-all duration-300
                  ${isSelected ? 'bg-primary' : 'bg-primary/0 group-hover:bg-primary/50'}
                `} />
              </Card>
            );
          })}
        </div>

        {/* No Methods Available */}
        {availableMethods.length === 0 && (
          <Card className="p-8 text-center animate-fade-in">
            <div className="space-y-2">
              <p className="text-lg font-medium">
                Nenhum método de pagamento disponível
              </p>
              <p className="text-sm text-muted-foreground">
                Entre em contato com o suporte para mais informações
              </p>
            </div>
          </Card>
        )}

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span>Pagamento 100% seguro</span>
          </div>
        </div>
      </div>
    </div>
  );
}
