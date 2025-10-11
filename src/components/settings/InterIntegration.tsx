import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function InterIntegration() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [certificate, setCertificate] = useState("");
  const [isSandbox, setIsSandbox] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showClientId, setShowClientId] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<any>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      setCompanyId(profile.company_id);

      const { data: settings } = await supabase
        .from("inter_settings")
        .select("*")
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (settings) {
        setIsConfigured(true);
        setIsSandbox(settings.is_sandbox);
        setLastTestResult(settings.test_result);
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error("Client ID e Client Secret são obrigatórios");
      return;
    }

    if (!companyId) {
      toast.error("Empresa não identificada");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("inter-integration", {
        body: {
          action: "save_settings",
          company_id: companyId,
          client_id: clientId,
          client_secret: clientSecret,
          certificate: certificate || null,
          is_sandbox: isSandbox,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Configurações salvas com sucesso");
        setIsConfigured(true);
        setClientId("");
        setClientSecret("");
        setCertificate("");
        await loadSettings();
      } else {
        throw new Error(data.error || "Erro ao salvar configurações");
      }
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error(error.message || "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!isConfigured && (!clientId || !clientSecret)) {
      toast.error("Configure as credenciais primeiro");
      return;
    }

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("inter-integration", {
        body: {
          action: "test_connection",
          company_id: companyId,
          client_id: clientId || undefined,
          client_secret: clientSecret || undefined,
          certificate: certificate || undefined,
          is_sandbox: isSandbox,
        },
      });

      if (error) throw error;

      setLastTestResult(data);

      if (data.success) {
        toast.success("Conexão testada com sucesso!");
      } else {
        toast.error("Erro ao testar conexão: " + (data.error || "Erro desconhecido"));
      }
    } catch (error: any) {
      console.error("Erro ao testar:", error);
      toast.error(error.message || "Erro ao testar conexão");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Inter (Banco Inter)</CardTitle>
            <CardDescription>
              Configure as credenciais da API do Banco Inter para gerar boletos e PIX
            </CardDescription>
          </div>
          <Badge variant={isConfigured ? "default" : "secondary"}>
            {isConfigured ? "Configurado" : "Não configurado"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <div className="relative">
              <Input
                id="clientId"
                type={showClientId ? "text" : "password"}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Digite o Client ID"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowClientId(!showClientId)}
              >
                {showClientId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientSecret">Client Secret</Label>
            <div className="relative">
              <Input
                id="clientSecret"
                type={showClientSecret ? "text" : "password"}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Digite o Client Secret"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowClientSecret(!showClientSecret)}
              >
                {showClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="certificate">Certificado Digital (Opcional)</Label>
            <textarea
              id="certificate"
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={certificate}
              onChange={(e) => setCertificate(e.target.value)}
              placeholder="Cole o certificado .crt em formato base64 (opcional para sandbox)"
            />
            <p className="text-xs text-muted-foreground">
              Necessário apenas para produção. Cole o conteúdo do arquivo .crt
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="sandbox"
              checked={isSandbox}
              onCheckedChange={setIsSandbox}
            />
            <Label htmlFor="sandbox">Modo Sandbox (Testes)</Label>
          </div>

          {isSandbox && (
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ Modo sandbox ativo. As cobranças não serão reais.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleSaveSettings}
              disabled={saving || !clientId || !clientSecret}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Configurações
            </Button>

            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || (!isConfigured && (!clientId || !clientSecret))}
            >
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Testar Conexão
            </Button>
          </div>

          {lastTestResult && (
            <div className={`rounded-lg p-4 ${lastTestResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <div className="flex items-start gap-2">
                {lastTestResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                )}
                <div>
                  <p className="font-medium text-sm">
                    {lastTestResult.success ? 'Conexão bem-sucedida' : 'Falha na conexão'}
                  </p>
                  {lastTestResult.message && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {lastTestResult.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {isConfigured && (
          <div className="space-y-2 pt-4 border-t">
            <h4 className="font-medium text-sm">Recursos disponíveis:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Criação de boletos bancários</li>
              <li>Geração de QR Code PIX</li>
              <li>Consulta de status de pagamentos</li>
              <li>Cancelamento de cobranças</li>
              <li>Webhooks para notificações automáticas</li>
            </ul>
          </div>
        )}

        <div className="space-y-2 pt-4 border-t">
          <h4 className="font-medium text-sm">Como obter as credenciais:</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Acesse o <a href="https://developers.inter.co" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Portal de Desenvolvedores do Inter</a></li>
            <li>Crie ou acesse sua aplicação</li>
            <li>Copie o Client ID e Client Secret</li>
            <li>Para produção, faça upload do certificado digital</li>
            <li>Configure o webhook URL: <code className="bg-muted px-1 py-0.5 rounded text-xs">https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/inter-webhook</code></li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
