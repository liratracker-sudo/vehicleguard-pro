import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { QrCode, Receipt, CreditCard, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import QRCode from 'qrcode';

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
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
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
          payment_url,
          pix_code,
          barcode,
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
        console.log('Payment already paid, showing success message');
        setPaymentResult({ 
          success: true,
          payment_url: paymentData.payment_url,
          pix_code: paymentData.pix_code,
          barcode: paymentData.barcode
        });
        
        // Gerar QR Code se tiver chave PIX
        if (paymentData.pix_code) {
          try {
            const qrDataUrl = await QRCode.toDataURL(paymentData.pix_code, {
              width: 300,
              margin: 2,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });
            setQrCodeDataUrl(qrDataUrl);
          } catch (err) {
            console.error('Error generating QR code for paid payment:', err);
          }
        }
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

      console.log('=== DETAILED RESPONSE DATA ===');
      console.log('Full data object:', JSON.stringify(data, null, 2));
      console.log('data.success:', data.success);
      console.log('data.pix_code exists:', !!data.pix_code);
      console.log('data.pix_code length:', data.pix_code?.length);
      console.log('data.payment_url:', data.payment_url);
      console.log('data.barcode:', data.barcode);
      console.log('===============================');

      if (!data.success) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error || 'Erro ao processar pagamento');
      }

      console.log('Payment processed successfully:', data);

      // Gerar QR Code se tiver chave PIX (com try/catch isolado)
      if (data.pix_code) {
        console.log('Generating QR Code for PIX:', data.pix_code);
        try {
          const qrDataUrl = await QRCode.toDataURL(data.pix_code, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          console.log('QR Code generated successfully');
          setQrCodeDataUrl(qrDataUrl);
        } catch (qrError) {
          console.error('Error generating QR code (non-critical):', qrError);
          // Continua mesmo se o QR Code falhar
        }
      }

      // Setar o resultado SEMPRE (mesmo se QR Code falhar)
      const result = {
        success: true,
        payment_url: data.payment_url,
        pix_code: data.pix_code,
        barcode: data.barcode
      };
      
      console.log('Setting payment result:', result);
      setPaymentResult(result);
      
      // Finalizar processamento DEPOIS de setar o resultado
      setProcessing(false);

      // Toast de sucesso
      if (selectedMethod === 'pix') {
        toast({
          title: "PIX gerado com sucesso",
          description: "Escaneie o QR Code ou copie a chave PIX"
        });
      } else if (selectedMethod === 'boleto') {
        toast({
          title: "Boleto gerado",
          description: "Boleto gerado com sucesso"
        });
      } else if (data.payment_url) {
        toast({
          title: "Pagamento processado",
          description: "Redirecionando para finalização..."
        });
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
      
      // Mostrar erro na tela
      setPaymentResult({
        success: false,
        error: errorMessage
      });
      
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
    console.log('=== PAYMENT RESULT STATE ===');
    console.log('paymentResult:', paymentResult);
    console.log('qrCodeDataUrl:', qrCodeDataUrl);
    console.log('has pix_code:', !!paymentResult.pix_code);
    console.log('=============================');
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center pb-4">
            {paymentResult.success ? (
              <>
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <CardTitle className="text-xl">Pagamento Gerado</CardTitle>
                <CardDescription className="text-sm">
                  {paymentResult.pix_code ? 'Escaneie o QR Code ou copie a chave PIX' : 'Pagamento processado com sucesso'}
                </CardDescription>
              </>
            ) : (
              <>
                <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
                <CardTitle className="text-xl">Pagamento Indisponível</CardTitle>
                <CardDescription className="text-sm">{paymentResult.error}</CardDescription>
              </>
            )}
          </CardHeader>

          {paymentResult.success && (
            <CardContent className="space-y-3">
              {/* QR Code PIX */}
              {paymentResult.pix_code && (
                <div className="space-y-3">
                  {qrCodeDataUrl ? (
                    <div className="bg-white p-3 rounded-lg flex items-center justify-center">
                      <img src={qrCodeDataUrl} alt="QR Code PIX" className="w-48 h-48" />
                    </div>
                  ) : (
                    <div className="bg-white p-3 rounded-lg flex items-center justify-center">
                      <Loader2 className="h-36 w-36 text-gray-400 animate-spin" />
                    </div>
                  )}
                  
                  <Separator className="my-2" />
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Chave PIX (Pix Copia e Cola)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={paymentResult.pix_code}
                        readOnly
                        className="flex-1 p-2 border rounded text-xs bg-muted font-mono"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(paymentResult.pix_code!);
                          toast({
                            title: "Copiado!",
                            description: "Chave PIX copiada para a área de transferência"
                          });
                        }}
                      >
                        Copiar
                      </Button>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg text-xs text-blue-900 dark:text-blue-100">
                    <p className="font-medium mb-1.5">Como pagar:</p>
                    <ol className="list-decimal list-inside space-y-0.5 text-xs">
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
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Código de Barras</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={paymentResult.barcode}
                        readOnly
                        className="flex-1 p-2 border rounded text-xs bg-muted font-mono"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(paymentResult.barcode!);
                          toast({
                            title: "Copiado!",
                            description: "Código de barras copiado"
                          });
                        }}
                      >
                        Copiar
                      </Button>
                    </div>
                  </div>

                  {paymentResult.payment_url && (
                    <Button
                      size="default"
                      className="w-full"
                      onClick={() => window.open(paymentResult.payment_url, '_blank')}
                    >
                      <Receipt className="mr-2 h-4 w-4" />
                      Abrir Boleto
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          )}
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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-8 px-4">
      <div className="max-w-lg mx-auto">
        <Card>
          <CardHeader className="text-center pb-4">
            {payment.company.logo_url && (
              <img 
                src={payment.company.logo_url} 
                alt={payment.company.name}
                className="h-12 mx-auto mb-3 object-contain"
              />
            )}
            <CardTitle className="text-xl">{payment.company.name}</CardTitle>
            <CardDescription className="text-sm">Pagamento seguro e rápido</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Detalhes do pagamento */}
            <div className="space-y-1.5 text-sm">
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
                <Badge variant={payment.status === 'overdue' ? 'destructive' : 'secondary'} className="text-xs">
                  {payment.status === 'pending' ? 'Pendente' : 'Vencido'}
                </Badge>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center pt-1">
                <span className="text-base font-semibold">Valor:</span>
                <span className="text-xl font-bold text-primary">
                  R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <Separator className="my-2" />

            {/* Seleção de método de pagamento */}
            <div className="space-y-3">
              <h3 className="font-semibold text-base">Escolha a forma de pagamento</h3>
              
              {availableMethods.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <p>Nenhum método de pagamento disponível no momento.</p>
                  <p className="text-xs mt-1">Entre em contato com {payment.company.name}</p>
                </div>
              ) : (
                <RadioGroup value={selectedMethod || ''} onValueChange={setSelectedMethod}>
                  <div className="grid grid-cols-2 gap-2">
                    {availableMethods.map((method) => (
                      <div key={method.key}>
                        <RadioGroupItem
                          value={method.key}
                          id={method.key}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={method.key}
                          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-muted bg-card p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all h-20"
                        >
                          <div className="[&>svg]:h-4 [&>svg]:w-4">
                            {method.icon}
                          </div>
                          <span className="text-xs font-medium">{method.label}</span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              )}
            </div>

            {/* Botão de pagamento */}
            {availableMethods.length > 0 && (
              <Button
                size="default"
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

            {/* Loading Overlay */}
            {processing && (
              <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
                <div className="bg-card border rounded-lg p-8 shadow-lg animate-scale-in">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <div className="absolute inset-0 h-12 w-12 animate-ping text-primary/20">
                        <Loader2 className="h-12 w-12" />
                      </div>
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="font-semibold text-lg">Processando pagamento</h3>
                      <p className="text-sm text-muted-foreground">
                        Aguarde enquanto geramos seu pagamento...
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Informações de segurança */}
            <div className="text-center text-xs text-muted-foreground pt-2">
              <p>🔒 Pagamento seguro e criptografado</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
