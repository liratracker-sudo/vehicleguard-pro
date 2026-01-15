import { useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Handshake, Calculator } from "lucide-react"

interface NegotiationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: {
    id: string
    amount: number
    client_id: string
    client_name: string
  }
  onSuccess?: () => void
}

export function NegotiationDialog({ 
  open, 
  onOpenChange, 
  payment,
  onSuccess 
}: NegotiationDialogProps) {
  const [agreementType, setAgreementType] = useState<'discount' | 'installments' | 'both'>('discount')
  const [discountPercent, setDiscountPercent] = useState(10)
  const [installments, setInstallments] = useState(3)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Calcular valores
  const discountValue = agreementType !== 'installments' 
    ? (payment.amount * discountPercent / 100) 
    : 0
  const finalAmount = payment.amount - discountValue
  const installmentValue = agreementType !== 'discount' 
    ? finalAmount / installments 
    : finalAmount

  const handleSubmit = async () => {
    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({ title: "Usuário não autenticado", variant: "destructive" })
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile) {
        toast({ title: "Perfil não encontrado", variant: "destructive" })
        return
      }

      // Salvar negociação
      const { error } = await supabase
        .from('protest_negotiations')
        .insert({
          company_id: profile.company_id,
          payment_id: payment.id,
          client_id: payment.client_id,
          original_amount: payment.amount,
          discount_percent: agreementType !== 'installments' ? discountPercent : 0,
          installments: agreementType !== 'discount' ? installments : 1,
          final_amount: finalAmount,
          installment_value: installmentValue,
          status: 'pending',
          notes,
          created_by: user.id
        })

      if (error) throw error

      toast({
        title: "Proposta registrada",
        description: `Proposta de acordo para ${payment.client_name} foi salva.`
      })

      onOpenChange(false)
      onSuccess?.()

      // Reset form
      setAgreementType('discount')
      setDiscountPercent(10)
      setInstallments(3)
      setNotes("")
    } catch (error) {
      console.error('Error saving negotiation:', error)
      toast({
        title: "Erro ao salvar proposta",
        description: "Não foi possível registrar a proposta de acordo.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-primary" />
            Proposta de Acordo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info do cliente */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Cliente</p>
            <p className="font-medium">{payment.client_name}</p>
            <p className="text-lg font-bold text-red-600 mt-1">
              R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Tipo de acordo */}
          <div className="space-y-2">
            <Label>Tipo de Acordo</Label>
            <RadioGroup 
              value={agreementType} 
              onValueChange={(v) => setAgreementType(v as typeof agreementType)}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="discount" id="discount" />
                <Label htmlFor="discount" className="font-normal cursor-pointer">
                  Desconto à vista
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="installments" id="installments" />
                <Label htmlFor="installments" className="font-normal cursor-pointer">
                  Parcelamento
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="both" id="both" />
                <Label htmlFor="both" className="font-normal cursor-pointer">
                  Desconto + Parcelamento
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Campos condicionais */}
          <div className="grid grid-cols-2 gap-4">
            {agreementType !== 'installments' && (
              <div className="space-y-2">
                <Label htmlFor="discount">Desconto (%)</Label>
                <Input
                  id="discount"
                  type="number"
                  min={0}
                  max={100}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                />
              </div>
            )}
            {agreementType !== 'discount' && (
              <div className="space-y-2">
                <Label htmlFor="installments">Parcelas</Label>
                <Input
                  id="installments"
                  type="number"
                  min={1}
                  max={24}
                  value={installments}
                  onChange={(e) => setInstallments(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          {/* Resumo do acordo */}
          <div className="p-3 bg-primary/10 rounded-lg space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Calculator className="h-4 w-4" />
              Resumo do Acordo
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {agreementType !== 'installments' && (
                <div>
                  <span className="text-muted-foreground">Desconto:</span>
                  <span className="ml-2 font-medium text-green-600">
                    -R$ {discountValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Valor Final:</span>
                <span className="ml-2 font-bold">
                  R$ {finalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {agreementType !== 'discount' && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Parcela:</span>
                  <span className="ml-2 font-medium">
                    {installments}x de R$ {installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Detalhes adicionais sobre a negociação..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Proposta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
