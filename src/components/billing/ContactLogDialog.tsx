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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PhoneCall, MessageSquare, Mail, User, MapPin } from "lucide-react"

interface ContactLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: {
    id: string
    client_id: string
    client_name: string
  }
  onSuccess?: () => void
}

const contactTypes = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'phone', label: 'Ligação', icon: PhoneCall },
  { value: 'email', label: 'E-mail', icon: Mail },
  { value: 'visit', label: 'Visita', icon: MapPin },
  { value: 'other', label: 'Outro', icon: User },
]

const contactResults = [
  { value: 'no_answer', label: 'Não atendeu' },
  { value: 'promised_payment', label: 'Prometeu pagar' },
  { value: 'refused', label: 'Recusou negociar' },
  { value: 'requested_deadline', label: 'Pediu prazo' },
  { value: 'negotiated', label: 'Negociou acordo' },
  { value: 'other', label: 'Outro' },
]

export function ContactLogDialog({ 
  open, 
  onOpenChange, 
  payment,
  onSuccess 
}: ContactLogDialogProps) {
  const [contactType, setContactType] = useState<string>('whatsapp')
  const [contactResult, setContactResult] = useState<string>('no_answer')
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

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

      // Salvar registro de contato
      const { error } = await supabase
        .from('protest_contact_history')
        .insert({
          company_id: profile.company_id,
          payment_id: payment.id,
          client_id: payment.client_id,
          contact_type: contactType,
          contact_result: contactResult,
          notes,
          created_by: user.id
        })

      if (error) throw error

      toast({
        title: "Contato registrado",
        description: `Contato com ${payment.client_name} foi registrado.`
      })

      onOpenChange(false)
      onSuccess?.()

      // Reset form
      setContactType('whatsapp')
      setContactResult('no_answer')
      setNotes("")
    } catch (error) {
      console.error('Error saving contact:', error)
      toast({
        title: "Erro ao registrar contato",
        description: "Não foi possível salvar o registro de contato.",
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
            <PhoneCall className="h-5 w-5 text-primary" />
            Registrar Contato
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info do cliente */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Cliente</p>
            <p className="font-medium">{payment.client_name}</p>
          </div>

          {/* Tipo de contato */}
          <div className="space-y-2">
            <Label>Tipo de Contato</Label>
            <Select value={contactType} onValueChange={setContactType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {contactTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resultado do contato */}
          <div className="space-y-2">
            <Label>Resultado</Label>
            <RadioGroup 
              value={contactResult} 
              onValueChange={setContactResult}
              className="flex flex-col gap-2"
            >
              {contactResults.map((result) => (
                <div key={result.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={result.value} id={result.value} />
                  <Label htmlFor={result.value} className="font-normal cursor-pointer">
                    {result.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Detalhes do contato..."
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
            {loading ? "Salvando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
