import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Copy, Check, QrCode as QrCodeIcon } from "lucide-react"
import { toast } from "sonner"
import QRCode from "qrcode"

export default function PublicRegistrationLink() {
  const [companySlug, setCompanySlug] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")

  useEffect(() => {
    loadCompanySlug()
  }, [])

  const loadCompanySlug = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile) return

      const { data: company } = await supabase
        .from('companies')
        .select('slug')
        .eq('id', profile.company_id)
        .single()

      if (company?.slug) {
        setCompanySlug(company.slug)
        generateQRCode(`${window.location.origin}/cadastro/${company.slug}`)
      }
    } catch (error) {
      console.error('Erro ao carregar slug da empresa:', error)
      toast.error('Erro ao carregar informações da empresa')
    } finally {
      setLoading(false)
    }
  }

  const generateQRCode = async (url: string) => {
    try {
      const qrCode = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      setQrCodeUrl(qrCode)
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error)
    }
  }

  const registrationUrl = companySlug 
    ? `${window.location.origin}/cadastro/${companySlug}`
    : ""

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(registrationUrl)
      setCopied(true)
      toast.success('Link copiado para a área de transferência!')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Erro ao copiar link')
    }
  }

  const downloadQRCode = () => {
    const link = document.createElement('a')
    link.href = qrCodeUrl
    link.download = `qrcode-cadastro-${companySlug}.png`
    link.click()
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!companySlug) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Link de Cadastro Público</CardTitle>
            <CardDescription>
              Não foi possível encontrar o slug da sua empresa.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Link de Cadastro Público</h1>
        <p className="text-muted-foreground">
          Compartilhe este link com seus clientes para que possam se cadastrar diretamente
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Link de Cadastro</CardTitle>
          <CardDescription>
            Copie e compartilhe este link com seus clientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input 
              value={registrationUrl} 
              readOnly 
              className="font-mono text-sm"
            />
            <Button 
              onClick={copyToClipboard}
              variant="outline"
              size="icon"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCodeIcon className="h-5 w-5" />
            QR Code
          </CardTitle>
          <CardDescription>
            Compartilhe o QR Code para facilitar o acesso ao formulário de cadastro
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          {qrCodeUrl && (
            <>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code para cadastro" 
                  className="w-[300px] h-[300px]"
                />
              </div>
              <Button onClick={downloadQRCode} variant="outline">
                Baixar QR Code
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
