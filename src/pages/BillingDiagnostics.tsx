import { AppLayout } from "@/components/layout/AppLayout";
import { BillingDiagnostics } from "@/components/billing/BillingDiagnostics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Link2, Loader2 } from "lucide-react";

const BillingDiagnosticsPage = () => {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);

  const handleUpdateUrls = async () => {
    setUpdating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('update-payment-urls');
      
      if (error) throw error;
      
      toast({
        title: "URLs atualizados",
        description: `${data.updated} pagamentos atualizados para usar checkout universal. ${data.skipped} já estavam corretos.`,
      });
    } catch (error) {
      console.error('Error updating URLs:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao atualizar URLs",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Diagnóstico de Notificações</h1>
          <p className="text-muted-foreground">
            Análise e correção do sistema de notificações automáticas
          </p>
        </div>

        {/* URL Migration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Migração para Checkout Universal
            </CardTitle>
            <CardDescription>
              Atualizar cobranças antigas que usam links diretos de gateway para o novo sistema de checkout universal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Esta ferramenta atualiza todas as cobranças pendentes/vencidas que ainda usam links diretos dos gateways (Asaas, Mercado Pago, etc.) 
              para usar o novo link de checkout universal, onde o cliente escolhe o método de pagamento.
            </p>
            <Button
              onClick={handleUpdateUrls}
              disabled={updating}
            >
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Atualizar Links de Pagamento
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <BillingDiagnostics />
      </div>
    </AppLayout>
  );
};

export default BillingDiagnosticsPage;