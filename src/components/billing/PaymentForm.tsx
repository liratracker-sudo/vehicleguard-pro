import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Link2 } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface PaymentFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function PaymentForm({ onSuccess, onCancel }: PaymentFormProps) {
  const [formData, setFormData] = useState({
    client_id: "",
    contract_id: "",
    amount: 0,
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  })
  
  const [description, setDescription] = useState("")
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
        supabase.from('clients').select('id, name, phone, email, document').eq('company_id', profile.company_id).order('name'),
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
    if (contractId === "none") {
      setFormData({
        ...formData,
        contract_id: ""
      })
      return
    }
    
    const contract = contracts.find(c => c.id === contractId)
    if (contract) {
      setFormData({
        ...formData,
        contract_id: contractId,
        client_id: contract.client_id,
        amount: contract.monthly_value
      })
      setDescription("")
    }
  }

  const generatePayment = async () => {
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const year = formData.due_date.getFullYear();
      const month = String(formData.due_date.getMonth() + 1).padStart(2, '0');
      const day = String(formData.due_date.getDate()).padStart(2, '0');
      const dueDateStr = `${year}-${month}-${day}`;

      const transactionData = {
        client_id: formData.client_id,
        contract_id: formData.contract_id || null,
        amount: formData.amount,
        company_id: profile.company_id,
        status: 'pending',
        transaction_type: formData.contract_id ? 'link' : 'avulso',
        due_date: dueDateStr,
        description: !formData.contract_id && description ? description : null
      };

      const { data: transaction, error } = await supabase
        .from('payment_transactions')
        .insert(transactionData)
        .select()
        .single();

      if (error) throw error;

      const baseUrl = import.meta.env.VITE_APP_URL || 'https://vehicleguard-pro.lovable.app';
      const checkoutUrl = `${baseUrl}/checkout/${transaction.id}`;

      await supabase
        .from('payment_transactions')
        .update({
          payment_url: checkoutUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.id);

      toast({
        title: "Cobrança gerada",
        description: "Link de pagamento gerado com sucesso!"
      });

      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: `Erro ao gerar cobrança: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredContracts = contracts.filter(c => 
    !formData.client_id || c.client_id === formData.client_id
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Gerar Cobrança
        </CardTitle>
        <CardDescription>
          Gera um link único de pagamento onde o cliente escolhe o método
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <SelectValue placeholder="Selecione o contrato (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (Cobrança Avulsa)</SelectItem>
                  {filteredContracts.map((contract) => (
                    <SelectItem key={contract.id} value={contract.id}>
                      R$ {contract.monthly_value.toFixed(2)} - {contract.clients?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(!formData.contract_id || formData.contract_id === "none") && (
            <div>
              <Label htmlFor="description">Descrição da Cobrança</Label>
              <Input
                id="description"
                placeholder="Ex: Taxa de instalação, Multa, Serviço avulso..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          )}

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
                  {formData.due_date ? format(formData.due_date, "dd/MM/yyyy") : "Selecione uma data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.due_date}
                  onSelect={(date) => date && setFormData({...formData, due_date: date})}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={generatePayment} disabled={loading}>
              {loading ? "Gerando..." : "Gerar Cobrança"}
            </Button>
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
