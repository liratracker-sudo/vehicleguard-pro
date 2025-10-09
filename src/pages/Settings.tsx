import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Users, Shield, Plug, MessageSquare, FileText, CreditCard, Bot } from "lucide-react"
import { WhatsAppIntegration } from "@/components/settings/WhatsAppIntegration"
import { AssinafyIntegration } from "@/components/settings/AssinafyIntegration"
import { AsaasIntegration } from "@/components/settings/AsaasIntegration"
import { GerencianetIntegration } from "@/components/settings/GerencianetIntegration"
import { BillingNotifications } from "@/components/settings/BillingNotifications"
import { AICollectionSettings } from "@/components/settings/AICollectionSettings"
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="billing">Cobrança</TabsTrigger>
            <TabsTrigger value="ai">IA</TabsTrigger>
            <TabsTrigger value="integrations">Integrações</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="assinafy">Assinafy</TabsTrigger>
            <TabsTrigger value="gerencianet">Gerencianet</TabsTrigger>
          </TabsList>

          <TabsContent value="billing" className="space-y-6">
            <BillingNotifications />
          </TabsContent>

          <TabsContent value="ai" className="space-y-6">
            <AICollectionSettings />
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plug className="w-5 h-5" />
                  Integrações Disponíveis
                </CardTitle>
                <CardDescription>
                  Configure suas integrações com serviços externos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" 
                        onClick={() => setActiveTab("whatsapp")}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <MessageSquare className="w-8 h-8 text-green-600" />
                      <div>
                        <h4 className="font-medium">WhatsApp Evolution</h4>
                        <p className="text-sm text-muted-foreground">Conexão Persistente</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" 
                        onClick={() => setActiveTab("assinafy")}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <FileText className="w-8 h-8 text-blue-600" />
                      <div>
                        <h4 className="font-medium">Assinafy</h4>
                        <p className="text-sm text-muted-foreground">Assinatura Digital</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="cursor-pointer hover:shadow-md transition-shadow" 
                        onClick={() => setActiveTab("asaas")}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <CreditCard className="w-8 h-8 text-purple-600" />
                      <div>
                        <h4 className="font-medium">Asaas</h4>
                        <p className="text-sm text-muted-foreground">Gateway de Pagamento</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="cursor-pointer hover:shadow-md transition-shadow" 
                        onClick={() => setActiveTab("gerencianet")}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <CreditCard className="w-8 h-8 text-orange-600" />
                      <div>
                        <h4 className="font-medium">Gerencianet</h4>
                        <p className="text-sm text-muted-foreground">Boletos e PIX</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-6">
            <WhatsAppIntegration />
          </TabsContent>

          <TabsContent value="assinafy" className="space-y-6">
            <AssinafyIntegration />
          </TabsContent>

          <TabsContent value="asaas" className="space-y-6">
            <AsaasIntegration />
          </TabsContent>

          <TabsContent value="gerencianet" className="space-y-6">
            <GerencianetIntegration />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

export default SettingsPage