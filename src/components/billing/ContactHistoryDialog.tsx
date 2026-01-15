import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  History, 
  MessageSquare, 
  PhoneCall, 
  Mail, 
  MapPin, 
  User,
  Handshake,
  Clock
} from "lucide-react"
import { formatDateBR } from "@/lib/timezone"

interface ContactHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: {
    id: string
    client_id: string
    client_name: string
  }
}

interface HistoryItem {
  id: string
  type: 'contact' | 'negotiation'
  date: string
  title: string
  description: string
  status?: string
  icon: React.ReactNode
}

const contactTypeIcons: Record<string, typeof MessageSquare> = {
  whatsapp: MessageSquare,
  phone: PhoneCall,
  email: Mail,
  visit: MapPin,
  other: User,
}

const contactResultLabels: Record<string, string> = {
  no_answer: 'Não atendeu',
  promised_payment: 'Prometeu pagar',
  refused: 'Recusou negociar',
  requested_deadline: 'Pediu prazo',
  negotiated: 'Negociou acordo',
  other: 'Outro',
}

const contactTypeLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  phone: 'Ligação',
  email: 'E-mail',
  visit: 'Visita',
  other: 'Outro',
}

export function ContactHistoryDialog({ 
  open, 
  onOpenChange, 
  payment 
}: ContactHistoryDialogProps) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open) {
      loadHistory()
    }
  }, [open, payment.id])

  const loadHistory = async () => {
    try {
      setLoading(true)

      // Carregar contatos
      const { data: contacts, error: contactsError } = await supabase
        .from('protest_contact_history')
        .select('*')
        .eq('payment_id', payment.id)
        .order('created_at', { ascending: false })

      if (contactsError) throw contactsError

      // Carregar negociações
      const { data: negotiations, error: negotiationsError } = await supabase
        .from('protest_negotiations')
        .select('*')
        .eq('payment_id', payment.id)
        .order('created_at', { ascending: false })

      if (negotiationsError) throw negotiationsError

      // Mapear histórico
      const historyItems: HistoryItem[] = []

      // Adicionar contatos
      contacts?.forEach((contact) => {
        const Icon = contactTypeIcons[contact.contact_type] || User
        historyItems.push({
          id: contact.id,
          type: 'contact',
          date: contact.created_at,
          title: `${contactTypeLabels[contact.contact_type] || contact.contact_type}`,
          description: contact.notes || contactResultLabels[contact.contact_result] || contact.contact_result,
          status: contact.contact_result,
          icon: <Icon className="h-4 w-4" />
        })
      })

      // Adicionar negociações
      negotiations?.forEach((neg) => {
        const discountText = neg.discount_percent > 0 
          ? `${neg.discount_percent}% desconto` 
          : ''
        const installmentsText = neg.installments > 1 
          ? `${neg.installments}x` 
          : 'à vista'
        
        historyItems.push({
          id: neg.id,
          type: 'negotiation',
          date: neg.created_at,
          title: 'Proposta de Acordo',
          description: `R$ ${neg.final_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${discountText ? `(${discountText})` : ''} ${installmentsText}. ${neg.notes || ''}`,
          status: neg.status,
          icon: <Handshake className="h-4 w-4" />
        })
      })

      // Ordenar por data
      historyItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      setHistory(historyItems)
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoading(false)
    }
  }

  const getResultBadge = (status: string | undefined, type: 'contact' | 'negotiation') => {
    if (!status) return null

    if (type === 'contact') {
      const colors: Record<string, string> = {
        no_answer: 'bg-gray-500',
        promised_payment: 'bg-emerald-500',
        refused: 'bg-red-500',
        requested_deadline: 'bg-amber-500',
        negotiated: 'bg-emerald-600',
        other: 'bg-gray-400',
      }
      return (
        <Badge className={`${colors[status] || 'bg-gray-500'} text-white border-0 text-xs`}>
          {contactResultLabels[status] || status}
        </Badge>
      )
    }

    if (type === 'negotiation') {
      const colors: Record<string, string> = {
        pending: 'bg-amber-500',
        accepted: 'bg-emerald-500',
        rejected: 'bg-red-500',
        cancelled: 'bg-gray-500',
      }
      const labels: Record<string, string> = {
        pending: 'Pendente',
        accepted: 'Aceito',
        rejected: 'Rejeitado',
        cancelled: 'Cancelado',
      }
      return (
        <Badge className={`${colors[status] || 'bg-gray-500'} text-white border-0 text-xs`}>
          {labels[status] || status}
        </Badge>
      )
    }

    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico - {payment.client_name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground">Nenhum registro de histórico</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
              
              <div className="space-y-4">
                {history.map((item, index) => (
                  <div key={item.id} className="relative flex gap-4 pl-10">
                    {/* Timeline dot */}
                    <div className={`absolute left-2 w-5 h-5 rounded-full border-2 bg-background flex items-center justify-center
                      ${item.type === 'negotiation' ? 'border-primary text-primary' : 'border-muted-foreground text-muted-foreground'}`}>
                      {item.icon}
                    </div>
                    
                    <div className="flex-1 bg-muted/50 rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{item.title}</span>
                        {getResultBadge(item.status, item.type)}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      <p className="text-xs text-muted-foreground/70">
                        {formatDateBR(item.date)} às {new Date(item.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
