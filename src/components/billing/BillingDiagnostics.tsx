import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle, PlayCircle, RefreshCw, Activity } from "lucide-react";

interface DiagnosticsData {
  companies_with_settings: number;
  overdue_payments: number;
  pending_notifications: number;
  failed_notifications: number;
  companies: Array<{
    company_id: string;
    company_name: string;
    overdue_payments: number;
    pending_notifications: number;
    failed_notifications: number;
    issues: string[];
  }>;
  actions_taken: string[];
}

export function BillingDiagnostics() {
  const [isRunning, setIsRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const runDiagnostics = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-diagnostics');
      
      if (error) {
        throw error;
      }

      if (data?.diagnostics) {
        setDiagnostics(data.diagnostics);
        toast({
          title: "Diagnóstico concluído",
          description: "Análise do sistema de notificações concluída com sucesso.",
        });
      }
    } catch (error) {
      console.error('Error running diagnostics:', error);
      toast({
        title: "Erro no diagnóstico",
        description: "Falha ao executar diagnóstico do sistema de notificações.",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const processNotifications = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-notifications', {
        body: {
          trigger: 'manual_admin_trigger',
          force: true
        }
      });
      
      if (error) {
        throw error;
      }

      toast({
        title: "Processamento iniciado",
        description: "Notificações pendentes foram processadas com sucesso.",
      });
      
      // Rerun diagnostics to show updated state
      setTimeout(() => runDiagnostics(), 2000);
    } catch (error) {
      console.error('Error processing notifications:', error);
      toast({
        title: "Erro no processamento",
        description: "Falha ao processar notificações pendentes.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const generateCharges = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-charges');
      
      if (error) {
        throw error;
      }

      toast({
        title: "Cobranças geradas",
        description: "Cobranças automáticas foram processadas com sucesso.",
      });
      
      // Rerun diagnostics to show updated state
      setTimeout(() => runDiagnostics(), 2000);
    } catch (error) {
      console.error('Error generating charges:', error);
      toast({
        title: "Erro na geração",
        description: "Falha ao gerar cobranças automáticas.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Diagnóstico do Sistema de Notificações
          </CardTitle>
          <CardDescription>
            Verifique o status das notificações automáticas e resolva problemas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={runDiagnostics} 
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              {isRunning ? "Executando..." : "Executar Diagnóstico"}
            </Button>
            
            <Button 
              onClick={processNotifications} 
              disabled={isProcessing}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isProcessing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              {isProcessing ? "Processando..." : "Processar Notificações"}
            </Button>

            <Button 
              onClick={generateCharges} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <PlayCircle className="h-4 w-4" />
              Gerar Cobranças
            </Button>
          </div>
        </CardContent>
      </Card>

      {diagnostics && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados do Diagnóstico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {diagnostics.companies_with_settings}
                </div>
                <div className="text-sm text-muted-foreground">
                  Empresas com Configurações
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {diagnostics.overdue_payments}
                </div>
                <div className="text-sm text-muted-foreground">
                  Pagamentos Vencidos
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {diagnostics.pending_notifications}
                </div>
                <div className="text-sm text-muted-foreground">
                  Notificações Pendentes
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">
                  {diagnostics.failed_notifications}
                </div>
                <div className="text-sm text-muted-foreground">
                  Notificações Falharam
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions Taken */}
            {diagnostics.actions_taken.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Ações Executadas
                </h3>
                <div className="space-y-1">
                  {diagnostics.actions_taken.map((action, index) => (
                    <div key={index} className="text-sm text-green-700 bg-green-50 p-2 rounded">
                      {action}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Company Details */}
            {diagnostics.companies.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Detalhes por Empresa</h3>
                <div className="space-y-3">
                  {diagnostics.companies.map((company) => (
                    <Card key={company.company_id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{company.company_name}</h4>
                        <div className="flex gap-2">
                          {company.overdue_payments > 0 && (
                            <Badge variant="destructive">
                              {company.overdue_payments} vencidos
                            </Badge>
                          )}
                          {company.pending_notifications > 0 && (
                            <Badge variant="secondary">
                              {company.pending_notifications} pendentes
                            </Badge>
                          )}
                          {company.failed_notifications > 0 && (
                            <Badge variant="outline">
                              {company.failed_notifications} falharam
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {company.issues.length > 0 && (
                        <div className="mt-2">
                          <h5 className="text-sm font-medium text-red-600 mb-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Problemas Identificados:
                          </h5>
                          <div className="space-y-1">
                            {company.issues.map((issue, index) => (
                              <Alert key={index} className="py-2">
                                <AlertDescription className="text-xs">
                                  {issue}
                                </AlertDescription>
                              </Alert>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {diagnostics.companies.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhuma empresa encontrada com configurações de notificação ativas.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}