import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, CheckCircle, XCircle, AlertTriangle, Bug, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DiagnosticResult {
  success: boolean;
  error?: string;
  diagnostic?: {
    original_phone: string;
    normalized_phone: string;
    instance_name: string;
    evolution_base_url: string;
    connection_status: any;
    instance_info: any;
    send_result: any;
    http_status: number;
    response_time_ms: number;
    message_id: string | null;
    log_saved: boolean;
    log_id: string;
  };
}

export function WhatsAppDiagnostic() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("🔧 Teste de diagnóstico WhatsApp");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const { toast } = useToast();

  const runDiagnostic = async () => {
    if (!phoneNumber) {
      toast({
        title: "Erro",
        description: "Informe o número de telefone",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Obter company_id do usuário
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) throw new Error("Empresa não encontrada");

      const { data, error } = await supabase.functions.invoke('whatsapp-test-diagnostic', {
        body: {
          phone_number: phoneNumber,
          message,
          company_id: profile.company_id
        }
      });

      if (error) throw error;

      setResult(data);

      toast({
        title: data.success ? "Mensagem enviada" : "Falha no envio",
        description: data.success 
          ? `ID: ${data.diagnostic?.message_id}` 
          : data.error || "Verifique os detalhes",
        variant: data.success ? "default" : "destructive"
      });

    } catch (error: any) {
      console.error('Erro no diagnóstico:', error);
      setResult({
        success: false,
        error: error.message || "Erro desconhecido"
      });
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Dados copiados para área de transferência" });
  };

  const getConnectionBadge = (status: any) => {
    if (!status) return <Badge variant="outline">Desconhecido</Badge>;
    
    const state = status.state || status.instance?.state;
    if (state === 'open') return <Badge className="bg-green-500">Conectado</Badge>;
    if (state === 'close') return <Badge variant="destructive">Desconectado</Badge>;
    return <Badge variant="secondary">{state || 'Indefinido'}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Diagnóstico de Envio WhatsApp
        </CardTitle>
        <CardDescription>
          Teste o envio de mensagens e veja a resposta completa da API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Número de Telefone</Label>
            <Input
              id="phone"
              placeholder="11999999999"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem de Teste</Label>
            <Input
              id="message"
              placeholder="Mensagem de teste..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={runDiagnostic} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executando diagnóstico...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Enviar Teste e Diagnosticar
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-4 pt-4 border-t">
            {/* Status Geral */}
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-6 w-6 text-green-500" />
              ) : (
                <XCircle className="h-6 w-6 text-red-500" />
              )}
              <span className="font-semibold text-lg">
                {result.success ? "Envio bem-sucedido" : "Falha no envio"}
              </span>
            </div>

            {result.error && (
              <div className="p-3 bg-destructive/10 rounded-lg text-destructive">
                <strong>Erro:</strong> {result.error}
              </div>
            )}

            {result.diagnostic && (
              <div className="space-y-3">
                {/* Info Básica */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div className="p-2 bg-muted rounded">
                    <div className="text-muted-foreground">Número Original</div>
                    <div className="font-mono">{result.diagnostic.original_phone}</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="text-muted-foreground">Normalizado</div>
                    <div className="font-mono">{result.diagnostic.normalized_phone}</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="text-muted-foreground">Instância</div>
                    <div className="font-mono">{result.diagnostic.instance_name}</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="text-muted-foreground">Tempo Resposta</div>
                    <div className="font-mono">{result.diagnostic.response_time_ms}ms</div>
                  </div>
                </div>

                {/* Status da Conexão */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Status da Conexão</span>
                    {getConnectionBadge(result.diagnostic.connection_status)}
                  </div>
                  <pre className="text-xs overflow-auto max-h-32 bg-background p-2 rounded">
                    {JSON.stringify(result.diagnostic.connection_status, null, 2)}
                  </pre>
                </div>

                {/* Resultado do Envio */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Resposta da Evolution API</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={result.diagnostic.http_status === 200 || result.diagnostic.http_status === 201 ? "default" : "destructive"}>
                        HTTP {result.diagnostic.http_status}
                      </Badge>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyToClipboard(JSON.stringify(result.diagnostic?.send_result, null, 2))}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <pre className="text-xs overflow-auto max-h-48 bg-background p-2 rounded">
                    {JSON.stringify(result.diagnostic.send_result, null, 2)}
                  </pre>
                </div>

                {/* Message ID */}
                {result.diagnostic.message_id && (
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Message ID:</span>
                      <code className="text-sm bg-background px-2 py-1 rounded">
                        {result.diagnostic.message_id}
                      </code>
                    </div>
                  </div>
                )}

                {/* Log Info */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {result.diagnostic.log_saved ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  )}
                  Log salvo: {result.diagnostic.log_saved ? 'Sim' : 'Não'}
                  {result.diagnostic.log_id && (
                    <code className="text-xs bg-muted px-1 rounded">{result.diagnostic.log_id}</code>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
