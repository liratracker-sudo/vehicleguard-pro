import { useState, useEffect } from "react"
import { CreditCard, MessageSquare, FileText } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { IntegrationCard } from "@/components/ui/integration-card"
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
    icon: <CreditCard className="h-5 w-5" />,
    iconColor: "text-blue-500",
    iconBgColor: "bg-blue-500/10",
    dialogKey: "asaas"
  },
  {
    key: "mercadopago" as keyof IntegrationStatus,
    name: "Mercado Pago",
    description: "Pagamentos online com Mercado Pago",
    icon: <CreditCard className="h-5 w-5" />,
    iconColor: "text-sky-500",
    iconBgColor: "bg-sky-500/10",
    dialogKey: "mercadopago"
  },
  {
    key: "gerencianet" as keyof IntegrationStatus,
    name: "Gerencianet / Efí Pay",
    description: "Emissão de boletos bancários",
    icon: <CreditCard className="h-5 w-5" />,
    iconColor: "text-orange-500",
    iconBgColor: "bg-orange-500/10",
    dialogKey: "gerencianet"
  },
  {
    key: "inter" as keyof IntegrationStatus,
    name: "Banco Inter",
    description: "Integração bancária para PIX e Boleto",
    icon: <CreditCard className="h-5 w-5" />,
    iconColor: "text-orange-600",
    iconBgColor: "bg-orange-600/10",
    dialogKey: "inter"
  },
  {
    key: "whatsapp" as keyof IntegrationStatus,
    name: "WhatsApp",
    description: "Envio de mensagens via WhatsApp",
    icon: <MessageSquare className="h-5 w-5" />,
    iconColor: "text-green-500",
    iconBgColor: "bg-green-500/10",
    dialogKey: "whatsapp"
  },
  {
    key: "assinafy" as keyof IntegrationStatus,
    name: "Assinafy",
    description: "Assinatura digital de contratos",
    icon: <FileText className="h-5 w-5" />,
    iconColor: "text-purple-500",
    iconBgColor: "bg-purple-500/10",
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

    const [asaas, mercadopago, gerencianet, inter, whatsapp, assinafy] = await Promise.all([
      supabase.from("asaas_settings").select("is_active").eq("company_id", companyId).maybeSingle(),
      supabase.from("mercadopago_settings").select("is_active").eq("company_id", companyId).maybeSingle(),
      supabase.from("gerencianet_settings").select("is_active").eq("company_id", companyId).maybeSingle(),
      supabase.from("inter_settings").select("is_active").eq("company_id", companyId).maybeSingle(),
      supabase.from("whatsapp_settings").select("is_active").eq("company_id", companyId).maybeSingle(),
      supabase.from("assinafy_settings").select("is_active").eq("company_id", companyId).maybeSingle()
    ])

    setStatus({
      asaas: asaas.data?.is_active || false,
      mercadopago: mercadopago.data?.is_active || false,
      gerencianet: gerencianet.data?.is_active || false,
      inter: inter.data?.is_active || false,
      whatsapp: whatsapp.data?.is_active || false,
      assinafy: assinafy.data?.is_active || false
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
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.key}
              name={integration.name}
              description={integration.description}
              icon={integration.icon}
              iconColor={integration.iconColor}
              iconBgColor={integration.iconBgColor}
              isActive={status[integration.key]}
              onConfigure={() => setOpenDialog(integration.dialogKey)}
            />
          ))}
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
