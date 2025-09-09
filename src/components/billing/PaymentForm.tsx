import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, CreditCard, QrCode, Link2, Receipt } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Badge } from "@/components/ui/badge"

interface PaymentFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function PaymentForm({ onSuccess, onCancel }: PaymentFormProps) {
  const [formData, setFormData] = useState({
    client_id: "",
    contract_id: "",
    transaction_type: "boleto",
    amount: 0,
    payment_gateway: "asaas",
    due_date: new Date()
  })
  
  const [clients, setClients] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile) return

      const [clientsRes, contractsRes] = await Promise.all([
        supabase.from('clients').select('id, name, phone, email').eq('company_id', profile.company_id),
        supabase.from('contracts').select('id, monthly_value, client_id, clients(name)').eq('company_id', profile.company_id).eq('status', 'active')
      ])

      if (clientsRes.data) setClients(clientsRes.data)
      if (contractsRes.data) setContracts(contractsRes.data)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleContractChange = (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId)
    if (contract) {
      setFormData({
        ...formData,
        contract_id: contractId,
        client_id: contract.client_id,
        amount: contract.monthly_value
      })
    }
  }

  const generatePayment = async () => {
    setLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile) throw new Error('Profile not found')

      // Create payment transaction record
      const transactionData = {
        ...formData,
        company_id: profile.company_id,
        status: 'pending',
        due_date: formData.due_date.toISOString().split('T')[0]
      }

      const { data: transaction, error } = await supabase
        .from('payment_transactions')
        .insert(transactionData)
        .select()
        .single()

      if (error) throw error

      // Simulate payment gateway integration
      const mockResponse = {
        payment_url: `https://checkout.${formData.payment_gateway}.com/pay/${transaction.id}`,
        pix_code: formData.transaction_type === 'pix' ? '00020126580014br.gov.bcb.pix013636313739316363' : null,
        barcode: formData.transaction_type === 'boleto' ? '34191790010104351004791020150008291070026000' : null
      }

      // Update transaction with gateway response
      await supabase
        .from('payment_transactions')
        .update({
          payment_url: mockResponse.payment_url,
          pix_code: mockResponse.pix_code,
          barcode: mockResponse.barcode,
          external_id: `${formData.payment_gateway}_${Date.now()}`
        })
        .eq('id', transaction.id)

      toast({
        title: "Cobrança gerada",
        description: `${getPaymentTypeLabel(formData.transaction_type)} gerado com sucesso!`
      })

      // Auto-send WhatsApp notification (autônoma)
      await sendWhatsAppNotification(transaction.client_id, transaction.id, formData.transaction_type, formData.amount)

      onSuccess?.()
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Erro",
        description: "Erro ao gerar cobrança",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const sendWhatsAppNotification = async (clientId: string, paymentId: string, type: string, amount: number) => {
    try {
      const client = clients.find(c => c.id === clientId)
      if (!client || !client.phone) return

      const message = `Olá ${client.name}! Sua cobrança de R$ ${amount.toFixed(2)} via ${getPaymentTypeLabel(type)} foi gerada. Vencimento: ${format(formData.due_date, 'dd/MM/yyyy')}.`

      // Envio autônomo via Edge Function centralizada
      const { error } = await supabase.functions.invoke('notify-whatsapp', {
        body: {
          client_id: clientId,
          payment_id: paymentId,
          message,
        }
      })

      if (error) throw error

      toast({
        title: "WhatsApp enviado",
        description: "Notificação enviada para o cliente"
      })
    } catch (error) {
      console.error('Error sending WhatsApp:', error)
      toast({
        title: "Erro ao enviar WhatsApp",
        description: "Verifique a integração do WhatsApp",
        variant: "destructive"
      })
    }
  }

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case 'boleto': return 'Boleto'
      case 'pix': return 'PIX'
      case 'link': return 'Link de Pagamento'
      case 'card': return 'Cartão'
      default: return type
    }
  }

  const getPaymentIcon = (type: string) => {
    switch (type) {
      case 'boleto': return <Receipt className="h-4 w-4" />
      case 'pix': return <QrCode className="h-4 w-4" />
      case 'link': return <Link2 className="h-4 w-4" />
      case 'card': return <CreditCard className="h-4 w-4" />
      default: return null
    }
  }

  const filteredContracts = contracts.filter(c => 
    !formData.client_id || c.client_id === formData.client_id
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getPaymentIcon(formData.transaction_type)}
          Gerar Cobrança
        </CardTitle>
        <CardDescription>
          Emita boletos, PIX e links de pagamento via gateways integrados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client_id">Cliente *</Label>
              <Select 
                value={formData.client_id}
                onValueChange={(value) => setFormData({...formData, client_id: value})}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="contract_id">Contrato</Label>
              <Select 
                value={formData.contract_id}
                onValueChange={handleContractChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o contrato" />
                </SelectTrigger>
                <SelectContent>
                  {filteredContracts.map((contract) => (
                    <SelectItem key={contract.id} value={contract.id}>
                      R$ {contract.monthly_value.toFixed(2)} - {contract.clients?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="transaction_type">Tipo de Cobrança *</Label>
              <Select 
                value={formData.transaction_type}
                onValueChange={(value) => setFormData({...formData, transaction_type: value})}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto">Boleto Bancário</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="link">Link de Pagamento</SelectItem>
                  <SelectItem value="card">Cartão</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="payment_gateway">Gateway *</Label>
              <Select 
                value={formData.payment_gateway}
                onValueChange={(value) => setFormData({...formData, payment_gateway: value})}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asaas">Asaas</SelectItem>
                  <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                  <SelectItem value="cora">Cora</SelectItem>
                  <SelectItem value="efi">Efi Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})}
                required
              />
            </div>
          </div>

          <div>
            <Label>Data de Vencimento *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.due_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.due_date ? (
                    format(formData.due_date, "PPP")
                  ) : (
                    <span>Selecione a data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.due_date}
                  onSelect={(date) => date && setFormData({...formData, due_date: date})}
                  initialFocus
                  disabled={(date) => date < new Date()}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={generatePayment} disabled={loading}>
              {loading ? "Gerando..." : "Gerar Cobrança"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}