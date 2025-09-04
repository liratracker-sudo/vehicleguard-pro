import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Users, Shield, Bell, Plug, MessageSquare } from "lucide-react"
import WhatsAppIntegration from "@/components/settings/WhatsAppIntegration"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState("general")
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="security">Segurança</TabsTrigger>
            <TabsTrigger value="notifications">Notificações</TabsTrigger>
            <TabsTrigger value="integrations">Integrações</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Sistema
                  </CardTitle>
                  <CardDescription>
                    Configurações gerais do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    Configurações Gerais
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Preferências
                  </CardTitle>
                  <CardDescription>
                    Configurações de interface e preferências
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    Configurar Preferências
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Usuários e Permissões
                </CardTitle>
                <CardDescription>
                  Gerencie usuários e níveis de acesso do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Gerenciar Usuários
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Segurança
                </CardTitle>
                <CardDescription>
                  Configurações de segurança e autenticação
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Configurar Segurança
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Notificações
                </CardTitle>
                <CardDescription>
                  Configure alertas e notificações do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Configurar Alertas
                </Button>
              </CardContent>
            </Card>
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
                        <h4 className="font-medium">WhatsApp</h4>
                        <p className="text-sm text-muted-foreground">Evolution API</p>
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
        </Tabs>
      </div>
    </AppLayout>
  )
}

export default SettingsPage