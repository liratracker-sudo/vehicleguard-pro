import { AppLayout } from "@/components/layout/AppLayout";
import { BillingDiagnostics } from "@/components/billing/BillingDiagnostics";

const BillingDiagnosticsPage = () => {
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

        <BillingDiagnostics />
      </div>
    </AppLayout>
  );
};

export default BillingDiagnosticsPage;