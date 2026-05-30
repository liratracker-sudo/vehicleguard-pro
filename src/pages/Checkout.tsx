import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QrCode, Receipt, CreditCard, Loader2, CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import QRCode from 'qrcode';

interface PaymentData {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  company_id: string;
  original_amount?: number;
  fine_amount?: number;
  interest_amount?: number;
  days_overdue?: number;
  isOverdue?: boolean;
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

interface LateFeeData {
  original_amount: number;
  fine_amount: number;
  interest_amount: number;
  total_amount: number;
  days_overdue: number;
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
  const [cpfInput, setCpfInput] = useState('');
  const [cpfError, setCpfError] = useState('');
  const [lateFees, setLateFees] = useState<LateFeeData | null>(null);
  const [isExpiredPayment, setIsExpiredPayment] = useState(false);
  const [manualPix, setManualPix] = useState<any>(null);
  const [paymentResult, setPaymentResult] = useState<{
    success: boolean;
    payment_url?: string;
    pix_code?: string;
    barcode?: string;
    error?: string;
    late_fees?: LateFeeData;
  } | null>(null);

  useEffect(() => {
    if (payment_id) {
      loadPaymentData();
    }
  }, [payment_id]);

  const loadPaymentData = async () => {
    try {
      setLoading(true);

      // Validar formato do UUID antes de buscar no banco
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (!payment_id || !uuidRegex.test(payment_id)) {
        console.error('UUID inválido ou truncado:', {
          payment_id,
          length: payment_id?.length,
          expected: 36
        });
        
        setPaymentResult({
          success: false,
          error: payment_id && payment_id.length < 36 
            ? 'Link de pagamento incompleto. Por favor, solicite um novo link de pagamento ou copie o link completo da mensagem.'
            : 'Link de pagamento inválido. Por favor, verifique o link recebido.'
        });
        setLoading(false);
        return;
      }

      // Buscar dados do checkout via RPC pública segura (não expõe outras transações/clientes)
      const { data: rpcData, error: paymentError } = await supabase
        .rpc('get_checkout_payment', { p_payment_id: payment_id });

      if (paymentError) throw paymentError;

      const paymentData = rpcData as any;

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
        
        if (paymentData.pix_code) {
          try {
            const qrDataUrl = await QRCode.toDataURL(paymentData.pix_code, {
              width: 300,
              margin: 2,
              color: { dark: '#000000', light: '#FFFFFF' }
            });
            setQrCodeDataUrl(qrDataUrl);
          } catch (err) {
            console.error('Error generating QR code for paid payment:', err);
          }
        }
        return;
      }

      if (paymentData.status === 'cancelled') {
        const cancellationReason = paymentData.cancellation_reason;
        const hasExternalId = !!paymentData.external_id;
        const canRegenerate = cancellationReason === 'expired' || 
                              (hasExternalId && cancellationReason !== 'manual');
        
        console.log('Cancellation check:', { cancellationReason, hasExternalId, canRegenerate });
        
        if (canRegenerate) {
          console.log('Payment expired or regenerable, allowing regeneration');
          setIsExpiredPayment(true);
        } else {
          console.log('Payment manually cancelled, blocking');
          setPaymentResult({ success: false, error: 'Pagamento cancelado' });
          return;
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(paymentData.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const isOverdue = today > dueDate;
      const daysOverdue = isOverdue ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

      setPayment({
        id: paymentData.id,
        amount: paymentData.amount,
        due_date: paymentData.due_date,
        status: paymentData.status,
        company_id: paymentData.company_id,
        original_amount: paymentData.original_amount,
        fine_amount: paymentData.fine_amount,
        interest_amount: paymentData.interest_amount,
        days_overdue: daysOverdue,
        isOverdue,
        client: {
          name: paymentData.client?.name,
          email: paymentData.client?.email,
          phone: paymentData.client?.phone,
          document: paymentData.client?.document,
        },
        company: {
          name: paymentData.company?.name,
          logo_url: paymentData.company?.logo_url,
        }
      });

      // Métodos e regras vêm na mesma RPC
      const methods = (paymentData.gateway_methods || []) as Array<{ payment_method: string; gateway_type: string }>;
      const gatewayRules = (paymentData.gateway_rules || []) as any[];

      // Filtrar regras que se aplicam ao valor (a RPC já filtra por min/max_amount)
      const applicableRules = gatewayRules;
      
      const activeRule = applicableRules.length > 0 ? applicableRules[0] : null;
      
      console.log('=== GATEWAY RULES DEBUG ===');
      console.log('Payment amount:', paymentData.amount);
      console.log('All rules from DB:', gatewayRules);
      console.log('Applicable rules after max_amount filter:', applicableRules);
      console.log('Active rule selected:', activeRule ? {
        name: activeRule.name,
        allowed_gateways: activeRule.allowed_gateways,
        allowed_methods: activeRule.allowed_methods,
        min_amount: activeRule.min_amount,
        max_amount: activeRule.max_amount,
        priority: activeRule.priority
      } : 'NONE');
      console.log('Available payment methods from DB:', methods);
      console.log('===========================');

      // Mapear para formato de UI
      const methodsMap: Record<string, PaymentMethod> = {
        'pix': { key: 'pix', label: 'PIX', icon: <QrCode className="h-5 w-5" />, gateway: '' },
        'boleto': { key: 'boleto', label: 'Boleto', icon: <Receipt className="h-5 w-5" />, gateway: '' },
        'credit_card': { key: 'credit_card', label: 'Cartão', icon: <CreditCard className="h-5 w-5" />, gateway: '' },
      };

      // Deduplicar por tipo de método de pagamento (mantém apenas o primeiro de cada tipo)
      // Tratar debit_card como credit_card para unificar em "Cartão"
      const uniqueMethods = new Map<string, PaymentMethod>();
      methods?.forEach(m => {
        let methodKey = m.payment_method;
        // Unificar débito e crédito em apenas "Cartão"
        if (methodKey === 'debit_card') methodKey = 'credit_card';
        
        // Se há uma regra ativa, aplicar filtros de gateway e método
        if (activeRule) {
          // Verificar se o gateway é permitido (null-safe check)
          const hasGatewayRestriction = activeRule.allowed_gateways && 
                                         Array.isArray(activeRule.allowed_gateways) && 
                                         activeRule.allowed_gateways.length > 0;
          
          if (hasGatewayRestriction && !activeRule.allowed_gateways.includes(m.gateway_type)) {
            console.log(`Blocking ${m.payment_method} - gateway ${m.gateway_type} not in allowed list:`, activeRule.allowed_gateways);
            return; // Pular este método pois o gateway não é permitido
          }
          
          // Verificar se o método é permitido (null-safe check)
          const hasMethodRestriction = activeRule.allowed_methods && 
                                        Array.isArray(activeRule.allowed_methods) && 
                                        activeRule.allowed_methods.length > 0;
          
          if (hasMethodRestriction && !activeRule.allowed_methods.includes(methodKey)) {
            console.log(`Blocking ${methodKey} - method not in allowed list:`, activeRule.allowed_methods);
            return; // Pular este método
          }
        }
        
        if (methodsMap[methodKey] && !uniqueMethods.has(methodKey)) {
          console.log(`Adding method ${methodKey} from gateway ${m.gateway_type}`);
          uniqueMethods.set(methodKey, {
            ...methodsMap[methodKey],
            gateway: m.gateway_type
          });
        }
      });
      const available = Array.from(uniqueMethods.values());

      setAvailableMethods(available);

      // Se não houver gateway ativo, tentar buscar config de PIX manual
      if (available.length === 0) {
        try {
          const { data: pixData } = await supabase.rpc('get_manual_pix_checkout' as any, {
            p_payment_id: payment_id,
          });
          if (pixData && (pixData as any).enabled) {
            setManualPix(pixData);
          }
        } catch (err) {
          console.warn('manual pix lookup failed', err);
        }
      }


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

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return numbers.slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const validateCpf = (cpf: string) => {
    const numbers = cpf.replace(/\D/g, '');
    return numbers.length === 11;
  };

  const handleMethodChange = (method: string) => {
    setSelectedMethod(method);
    setCpfError('');
    // Limpar CPF ao mudar de método
    if (method !== 'boleto') {
      setCpfInput('');
    }
  };

  const handleCpfChange = (value: string) => {
    const formatted = formatCpf(value);
    setCpfInput(formatted);
    if (value.replace(/\D/g, '').length > 0) {
      setCpfError('');
    }
  };

  const processPayment = async () => {
    if (!selectedMethod || !payment) {
      console.log('Missing data:', { selectedMethod, payment });
      return;
    }

    // Validar CPF para boleto se cliente não tiver documento
    if (selectedMethod === 'boleto' && !payment.client.document) {
      if (!cpfInput) {
        setCpfError('CPF é obrigatório para gerar boleto');
        toast({
          title: "CPF obrigatório",
          description: "Por favor, informe seu CPF para gerar o boleto",
          variant: "destructive"
        });
        return;
      }
      
      if (!validateCpf(cpfInput)) {
        setCpfError('CPF inválido');
        toast({
          title: "CPF inválido",
          description: "Por favor, informe um CPF válido",
          variant: "destructive"
        });
        return;
      }
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
      
      const clientData = {
        ...payment.client,
        // Se boleto e não tem documento, usar o CPF digitado
        ...(selectedMethod === 'boleto' && !payment.client.document && cpfInput ? {
          document: cpfInput.replace(/\D/g, '')
        } : {})
      };
      
      const { data, error } = await supabase.functions.invoke('process-checkout', {
        body: {
          payment_id: payment.id,
          payment_method: selectedMethod,
          client_data: clientData
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
        barcode: data.barcode,
        late_fees: data.late_fees
      };
      
      // Se tem late fees, salvar no state
      if (data.late_fees) {
        setLateFees(data.late_fees);
      }
      
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
              {payment.company.logo_url ? (
                <img 
                  src={payment.company.logo_url} 
                  alt={payment.company.name}
                  className="h-16 mx-auto object-contain"
                />
              ) : (
                <div className="h-8" />
              )}
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
                  {payment.due_date ? payment.due_date.split('-').reverse().join('/') : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={payment.isOverdue ? 'destructive' : 'secondary'} className="text-xs">
                  {payment.isOverdue ? 'Vencido' : 'Pendente'}
                </Badge>
              </div>
              
              <Separator className="my-2" />
              
              {/* Late fee breakdown - shown when there are late fees after payment processing */}
              {lateFees && lateFees.fine_amount + lateFees.interest_amount > 0 ? (
                <div className="space-y-1.5 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Valor original:</span>
                    <span>R$ {lateFees.original_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {lateFees.fine_amount > 0 && (
                    <div className="flex justify-between items-center text-sm text-orange-600 dark:text-orange-400">
                      <span>Multa por atraso:</span>
                      <span>+ R$ {lateFees.fine_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {lateFees.interest_amount > 0 && (
                    <div className="flex justify-between items-center text-sm text-orange-600 dark:text-orange-400">
                      <span>Juros ({lateFees.days_overdue} dias):</span>
                      <span>+ R$ {lateFees.interest_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <Separator className="my-1" />
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-base font-semibold">Total a pagar:</span>
                    <span className="text-xl font-bold text-primary">
                      R$ {lateFees.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ) : payment.isOverdue ? (
                // Show warning that late fees may apply
                <div className="space-y-1.5">
                  <div className="p-2 bg-orange-50 dark:bg-orange-950/30 rounded border border-orange-200 dark:border-orange-800 mb-2">
                    <p className="text-xs text-orange-700 dark:text-orange-300 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Cobrança vencida há {payment.days_overdue} dia(s). Multa e juros podem ser aplicados.
                    </p>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-base font-semibold">Valor:</span>
                    <span className="text-xl font-bold text-primary">
                      R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center pt-1">
                  <span className="text-base font-semibold">Valor:</span>
                  <span className="text-xl font-bold text-primary">
                    R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            {/* Alerta de PIX expirado */}
            {isExpiredPayment && (
              <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
                <RefreshCw className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 dark:text-amber-300">Código de pagamento expirado</AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-400">
                  O código de pagamento anterior expirou. Selecione a forma de pagamento abaixo para gerar um novo código.
                </AlertDescription>
              </Alert>
            )}

            <Separator className="my-2" />

            {/* Seleção de método de pagamento */}
            <div className="space-y-3">
              <h3 className="font-semibold text-base">Escolha a forma de pagamento</h3>
              
              {availableMethods.length === 0 ? (
                manualPix?.enabled ? (
                  <div className="space-y-3 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                    <div className="flex items-center gap-2">
                      <QrCode className="h-5 w-5 text-primary" />
                      <span className="font-semibold">Pagamento via PIX direto</span>
                    </div>

                    {/* Resumo do valor */}
                    <div className="space-y-1 text-sm">
                      {Number(manualPix.discount_applied) > 0 && !manualPix.is_overdue && (
                        <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                          <span>Desconto até o vencimento:</span>
                          <span>- R$ {Number(manualPix.discount_applied).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {Number(manualPix.surcharge_applied) > 0 && manualPix.is_overdue && (
                        <div className="flex justify-between text-orange-700 dark:text-orange-400">
                          <span>Acréscimo por atraso:</span>
                          <span>+ R$ {Number(manualPix.surcharge_applied).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <Separator className="my-2" />
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Total a pagar:</span>
                        <span className="text-2xl font-bold text-primary">
                          R$ {Number(manualPix.amount_due).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-1.5">
                      <Label className="text-xs">Beneficiário</Label>
                      <p className="text-sm font-medium">{manualPix.beneficiary_name}</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Chave PIX ({manualPix.pix_key_type})</Label>
                      <div className="flex gap-2">
                        <Input value={manualPix.pix_key} readOnly className="font-mono text-xs" />
                        <Button
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(manualPix.pix_key);
                            toast({ title: 'Copiado!', description: 'Chave PIX copiada' });
                          }}
                        >
                          Copiar
                        </Button>
                      </div>
                    </div>

                    {manualPix.instructions && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs whitespace-pre-line">
                          {manualPix.instructions}
                        </AlertDescription>
                      </Alert>
                    )}

                    <p className="text-xs text-muted-foreground text-center">
                      Após o pagamento, envie o comprovante ao atendente de {payment.company.name}.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <p>Nenhum método de pagamento disponível no momento.</p>
                    <p className="text-xs mt-1">Entre em contato com {payment.company.name}</p>
                  </div>
                )
              ) : (
                <RadioGroup value={selectedMethod || ''} onValueChange={handleMethodChange}>
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

            {/* Input de CPF para Boleto quando cliente não tem documento */}
            {selectedMethod === 'boleto' && !payment.client.document && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Para gerar o boleto, precisamos do seu CPF
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="cpf-input" className="text-xs font-medium">
                        CPF
                      </Label>
                      <Input
                        id="cpf-input"
                        type="text"
                        placeholder="000.000.000-00"
                        value={cpfInput}
                        onChange={(e) => handleCpfChange(e.target.value)}
                        maxLength={14}
                        className={cpfError ? 'border-destructive' : ''}
                      />
                      {cpfError && (
                        <p className="text-xs text-destructive">{cpfError}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                  'Pagar'
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
