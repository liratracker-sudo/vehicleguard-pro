import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, CreditCard, QrCode, Link2, Receipt, Search, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useAsaas } from "@/hooks/useAsaas"
import { supabase } from "@/integrations/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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
  
  const [cpf, setCpf] = useState("")
  const [existingCharges, setExistingCharges] = useState<any[]>([])
  const [showCharges, setShowCharges] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { findChargesByCpf, loading: asaasLoading } = useAsaas()

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
        supabase.from('clients').select('id, name, phone, email, document').eq('company_id', profile.company_id),
        supabase.from('contracts').select('id, monthly_value, client_id, clients(name)').eq('company_id', profile.company_id).eq('status', 'active')
      ])

      if (clientsRes.data) setClients(clientsRes.data)
      if (contractsRes.data) setContracts(contractsRes.data)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    const part1 = digits.slice(0, 3)
    const part2 = digits.slice(3, 6)
    const part3 = digits.slice(6, 9)
    const part4 = digits.slice(9, 11)
    let out = part1
    if (part2) out += `.${part2}`
    if (part3) out += `.${part3}`
    if (part4) out += `-${part4}`
    return out
  }

  const searchClientByCpf = async () => {
    const cpfDigits = cpf.replace(/\D/g, '')
    if (cpfDigits.length !== 11) {
      toast({
        title: "CPF inválido",
        description: "Digite um CPF válido com 11 dígitos",
        variant: "destructive"
      })
      return
    }

    // 1. Buscar cliente local por CPF
    const localClient = clients.find(c => c.document?.replace(/\D/g, '') === cpfDigits)
    if (localClient) {
      setFormData(prev => ({ ...prev, client_id: localClient.id }))
      toast({
        title: "Cliente encontrado",
        description: `Cliente ${localClient.name} selecionado`
      })
    }

    // 2. Consultar cobranças existentes no Asaas
    try {
      const result = await findChargesByCpf(cpfDigits)
      if (result.customerFound && result.charges) {
        setExistingCharges(result.charges)
        setShowCharges(true)
        if (result.charges.length > 0) {
          toast({
            title: "Cobranças encontradas",
            description: `${result.charges.length} cobrança(s) encontrada(s) no Asaas`,
            variant: "default"
          })
        }
      } else {
        setExistingCharges([])
        setShowCharges(false)
      }
    } catch (error) {
      // Error already handled by the hook
      setExistingCharges([])
      setShowCharges(false)
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'RECEIVED':
      case 'CONFIRMED': return 'default'
      case 'PENDING': return 'secondary'
      case 'OVERDUE': return 'destructive'
      default: return 'outline'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'RECEIVED':
      case 'CONFIRMED': return 'Pago'
      case 'PENDING': return 'Pendente'
      case 'OVERDUE': return 'Vencido'
      default: return status
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

      // Generate payment using Asaas integration
      const { data: paymentResponse, error: paymentError } = await supabase.functions.invoke('asaas-integration', {
        body: {
          action: 'create_payment',
          customer_id: formData.client_id,
          value: formData.amount,
          dueDate: formData.due_date.toISOString().split('T')[0],
          billingType: formData.transaction_type.toUpperCase(),
          description: `Cobrança gerada via sistema`
        }
      })

      if (paymentError) throw paymentError

      // Update transaction with gateway response
      await supabase
        .from('payment_transactions')
        .update({
          payment_url: paymentResponse.invoiceUrl || paymentResponse.bankSlipUrl,
          pix_code: paymentResponse.pixQrCodeId,
          barcode: paymentResponse.identificationField,
          external_id: paymentResponse.id
        })
        .eq('id', transaction.id)

      toast({
        title: "Cobrança gerada",
        description: `${getPaymentTypeLabel(formData.transaction_type)} gerado com sucesso!`
      })

      // Auto-send WhatsApp notification
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

      const { error } = await supabase.functions.invoke('notify-whatsapp', {
        body: {
          client_id: clientId,
          payment_id: paymentId,
          event_type: 'manual',
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
      case 'BOLETO': return 'Boleto'
      case 'PIX': return 'PIX'
      case 'CREDIT_CARD': return 'Cartão'
      case 'DEBIT_CARD': return 'Débito'
      default: return type
    }
  }

  const getPaymentIcon = (type: string) => {
    switch (type) {
      case 'BOLETO': return <Receipt className="h-4 w-4" />
      case 'PIX': return <QrCode className="h-4 w-4" />
      case 'CREDIT_CARD': return <CreditCard className="h-4 w-4" />
      case 'DEBIT_CARD': return <CreditCard className="h-4 w-4" />
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
          {/* CPF Search Section */}
          <div className="border rounded-lg p-4 bg-muted/20">
            <Label htmlFor="cpf">Buscar por CPF</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="cpf"
                placeholder="Digite o CPF do cliente"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                maxLength={14}
                inputMode="numeric"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={searchClientByCpf}
                disabled={asaasLoading}
              >
                <Search className={`w-4 h-4 mr-2 ${asaasLoading ? 'animate-pulse' : ''}`} />
                Buscar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Busca o cliente no sistema local e consulta cobranças existentes no Asaas
            </p>
          </div>

          {/* Existing Charges Section */}
          {showCharges && existingCharges.length > 0 && (
            <div className="border rounded-lg p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <h4 className="font-medium text-amber-800 dark:text-amber-200">
                  Cobranças Existentes no Asaas
                </h4>
              </div>
              <div className="rounded border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Valor</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[120px]">Vencimento</TableHead>
                      <TableHead>Link de Pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {existingCharges.slice(0, 3).map((charge: any) => (
                      <TableRow key={charge.id}>
                        <TableCell className="font-medium">
                          R$ {(charge.value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(charge.status)}>
                            {getStatusLabel(charge.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {charge.dueDate ? new Date(charge.dueDate).toLocaleDateString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell>
                          {charge.invoiceUrl || charge.bankSlipUrl ? (
                            <a
                              href={charge.invoiceUrl || charge.bankSlipUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline text-sm"
                            >
                              Ver cobrança
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {existingCharges.length > 3 && (
                <p className="text-xs text-muted-foreground mt-2">
                  E mais {existingCharges.length - 3} cobrança(s)...
                </p>
              )}
            </div>
          )}

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
                  <SelectItem value="BOLETO">Boleto Bancário</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                  <SelectItem value="DEBIT_CARD">Cartão de Débito</SelectItem>
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
                    format(formData.due_date, "dd/MM/yyyy")
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