import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PaymentGatewayConfig } from "@/components/settings/PaymentGatewayConfig"
import { PaymentGatewayRules } from "@/components/settings/PaymentGatewayRules"
import { IntegrationsGrid } from "@/components/settings/IntegrationsGrid"
import { BillingNotifications } from "@/components/settings/BillingNotifications"
import { AICollectionSettings } from "@/components/settings/AICollectionSettings"
import { LateFeeSettings } from "@/components/settings/LateFeeSettings"
import { WhatsAppDiagnostic } from "@/components/settings/WhatsAppDiagnostic"
import { ApiKeysManagement } from "@/components/settings/ApiKeysManagement"
import { ExpenseNotifications } from "@/components/settings/ExpenseNotifications"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

const SettingsPage = () => {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab")
    return tab || "billing"
  })
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast({
          title: "Acesso restrito",
          description: "Faça login para acessar as Configurações.",
          variant: "destructive",
        })
        navigate("/auth")
      }
    })
  }, [navigate, toast])

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">
            Configurações gerais do sistema e integrações
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full inline-flex h-auto flex-wrap sm:flex-nowrap gap-1 sm:gap-0 p-1 justify-start overflow-x-auto">
            <TabsTrigger value="billing" className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3">Cobrança</TabsTrigger>
            <TabsTrigger value="expenses" className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3">Despesas</TabsTrigger>
            <TabsTrigger value="ai" className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3">IA</TabsTrigger>
            <TabsTrigger value="integrations" className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3">Integrações</TabsTrigger>
            <TabsTrigger value="api" className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3">API</TabsTrigger>
          </TabsList>

          <TabsContent value="billing" className="space-y-6">
            <BillingNotifications />
            <LateFeeSettings />
          </TabsContent>

          <TabsContent value="expenses" className="space-y-6">
            <ExpenseNotifications />
          </TabsContent>

          <TabsContent value="ai" className="space-y-6">
            <AICollectionSettings />
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <PaymentGatewayConfig />
            <PaymentGatewayRules />
            <IntegrationsGrid />
            <WhatsAppDiagnostic />
          </TabsContent>

          <TabsContent value="api" className="space-y-6">
            <ApiKeysManagement />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

export default SettingsPage