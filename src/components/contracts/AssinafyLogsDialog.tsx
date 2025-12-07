import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";

interface AssinafyLog {
  id: string;
  operation_type: string;
  status: string;
  request_data: any;
  response_data: any;
  error_message: string | null;
  created_at: string;
  contract_id: string | null;
}

interface AssinafyLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId?: string;
}

export function AssinafyLogsDialog({ open, onOpenChange, contractId }: AssinafyLogsDialogProps) {
  const [logs, setLogs] = useState<AssinafyLog[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadLogs();
    }
  }, [open, contractId]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 8000)
      );

      const loadPromise = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!profile?.company_id) return [];

        let query = supabase
          .from('assinafy_logs')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (contractId) {
          query = query.eq('contract_id', contractId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      };

      const result = await Promise.race([loadPromise(), timeoutPromise]);
      setLogs(result as AssinafyLog[]);
    } catch (error: any) {
      console.error('Erro ao carregar logs:', error);
      toast({
        title: "Erro",
        description: error.message === 'Timeout' 
          ? "Tempo esgotado ao carregar logs" 
          : "Erro ao carregar logs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      success: "default",
      error: "destructive",
      pending: "secondary"
    };

    return (
      <Badge variant={variants[status] || "secondary"}>
        {status}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            Logs Assinafy {contractId ? '- Contrato específico' : '- Todos'}
          </DialogTitle>
          <DialogDescription>
            Histórico de operações com a API Assinafy
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[600px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum log encontrado
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log.status)}
                      <span className="font-medium">{log.operation_type}</span>
                      {getStatusBadge(log.status)}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  {log.error_message && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded p-3">
                      <p className="text-sm font-medium text-destructive mb-1">Erro:</p>
                      <p className="text-sm text-destructive/80">{log.error_message}</p>
                    </div>
                  )}

                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                      Request Data
                    </summary>
                    <pre className="mt-2 bg-muted p-3 rounded text-xs overflow-x-auto">
                      {JSON.stringify(log.request_data, null, 2)}
                    </pre>
                  </details>

                  {log.response_data && Object.keys(log.response_data).length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                        Response Data
                      </summary>
                      <pre className="mt-2 bg-muted p-3 rounded text-xs overflow-x-auto">
                        {JSON.stringify(log.response_data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
