import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Settings, CreditCard, MessageSquare, FileText } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { AsaasIntegrationDialog } from "./dialogs/AsaasIntegrationDialog"
import { MercadoPagoIntegrationDialog } from "./dialogs/MercadoPagoIntegrationDialog"
import { GerencianetIntegrationDialog } from "./dialogs/GerencianetIntegrationDialog"
import { InterIntegrationDialog } from "./dialogs/InterIntegrationDialog"
import { WhatsAppIntegrationDialog } from "./dialogs/WhatsAppIntegrationDialog"
import { AssinafyIntegrationDialog } from "./dialogs/AssinafyIntegrationDialog"

interface IntegrationStatus {
  asaas: boolean
  mercadopago: boolean
  gerencianet: boolean
  inter: boolean
  whatsapp: boolean
  assinafy: boolean
}

const integrations = [
  {
    key: "asaas" as keyof IntegrationStatus,
    name: "Asaas",
    description: "Emissão automática de cobranças PIX e Boleto",
    icon: CreditCard,
    color: "text-blue-500",
    dialogKey: "asaas"
  },
  {
    key: "mercadopago" as keyof IntegrationStatus,
    name: "Mercado Pago",
    description: "Pagamentos online com Mercado Pago",
    icon: CreditCard,
    color: "text-sky-500",
    dialogKey: "mercadopago"
  },
  {
    key: "gerencianet" as keyof IntegrationStatus,
    name: "Gerencianet / Efí Pay",
    description: "Emissão de boletos bancários",
    icon: CreditCard,
    color: "text-orange-500",
    dialogKey: "gerencianet"
  },
  {
    key: "inter" as keyof IntegrationStatus,
    name: "Banco Inter",
    description: "Integração bancária para PIX e Boleto",
    icon: CreditCard,
    color: "text-orange-600",
    dialogKey: "inter"
  },
  {
    key: "whatsapp" as keyof IntegrationStatus,
    name: "WhatsApp",
    description: "Envio de mensagens via WhatsApp",
    icon: MessageSquare,
    color: "text-green-500",
    dialogKey: "whatsapp"
  },
  {
    key: "assinafy" as keyof IntegrationStatus,
    name: "Assinafy",
    description: "Assinatura digital de contratos",
    icon: FileText,
    color: "text-purple-500",
    dialogKey: "assinafy"
  }
]

export function IntegrationsGrid() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [status, setStatus] = useState<IntegrationStatus>({
    asaas: false,
    mercadopago: false,
    gerencianet: false,
    inter: false,
    whatsapp: false,
    assinafy: false
  })
  const [openDialog, setOpenDialog] = useState<string | null>(null)

  useEffect(() => {
    loadCompanyId()
  }, [])

  useEffect(() => {
    if (companyId) {
      loadStatus()
    }
  }, [companyId])

  const loadCompanyId = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single()

    if (profile) {
      setCompanyId(profile.company_id)
    }
  }

  const loadStatus = async () => {
    if (!companyId) return

    const [asaas, mercadopago, gerencianet, inter, whatsapp, companies] = await Promise.all([
      supabase.from("asaas_settings").select("is_active").eq("company_id", companyId).maybeSingle(),
      supabase.from("mercadopago_settings").select("is_active").eq("company_id", companyId).maybeSingle(),
      supabase.from("gerencianet_settings").select("is_active").eq("company_id", companyId).maybeSingle(),
      supabase.from("inter_settings").select("is_active").eq("company_id", companyId).maybeSingle(),
      supabase.from("whatsapp_settings").select("is_active").eq("company_id", companyId).maybeSingle(),
      supabase.from("companies").select("settings").eq("id", companyId).single()
    ])

    const settings = companies.data?.settings as { assinafy_configured?: boolean } | null
    
    setStatus({
      asaas: asaas.data?.is_active || false,
      mercadopago: mercadopago.data?.is_active || false,
      gerencianet: gerencianet.data?.is_active || false,
      inter: inter.data?.is_active || false,
      whatsapp: whatsapp.data?.is_active || false,
      assinafy: settings?.assinafy_configured || false
    })
  }

  const handleDialogClose = () => {
    setOpenDialog(null)
    loadStatus()
  }

  return (
    <>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Integrações</h3>
          <p className="text-sm text-muted-foreground">
            Configure as integrações do sistema
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((integration) => {
            const Icon = integration.icon
            const isActive = status[integration.key]

            return (
              <Card key={integration.key} className="relative hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`${integration.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{integration.name}</CardTitle>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setOpenDialog(integration.dialogKey)}
                      className="h-8 w-8"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription className="text-xs mt-2">
                    {integration.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
                    {isActive ? "Configurado" : "Não Configurado"}
                  </Badge>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <AsaasIntegrationDialog open={openDialog === "asaas"} onClose={handleDialogClose} />
      <MercadoPagoIntegrationDialog open={openDialog === "mercadopago"} onClose={handleDialogClose} />
      <GerencianetIntegrationDialog open={openDialog === "gerencianet"} onClose={handleDialogClose} />
      <InterIntegrationDialog open={openDialog === "inter"} onClose={handleDialogClose} />
      <WhatsAppIntegrationDialog open={openDialog === "whatsapp"} onClose={handleDialogClose} />
      <AssinafyIntegrationDialog open={openDialog === "assinafy"} onClose={handleDialogClose} />
    </>
  )
}
