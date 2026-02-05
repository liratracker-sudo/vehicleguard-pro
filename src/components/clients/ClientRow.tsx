import { Phone, Mail, MoreHorizontal, Edit, Trash2, FileText, History, Eye, MessageSquare, MessageSquareOff, Ban, Gift, Unlock } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TableCell, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { ClientStatus } from "./ClientStatus"
import { ClientScoreBadge } from "./ClientScoreBadge"
import type { ClientScore } from "@/hooks/useClientScore"

interface Client {
  id: string
  name: string
  email: string | null
  phone: string
  document: string | null
  status: string
  whatsapp_opt_out: boolean | null
  whatsapp_blocked: boolean | null
  whatsapp_block_reason: string | null
  is_courtesy: boolean | null
}

interface ClientRowProps {
  client: Client
  score?: ClientScore | null
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string, name: string) => void
  onViewContracts: (id: string) => void
  onViewPaymentHistory: (id: string) => void
  onToggleWhatsApp: (id: string, currentOptOut: boolean | null) => void
  onUnblockWhatsApp: (id: string) => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function ClientRow({
  client,
  score,
  onView,
  onEdit,
  onDelete,
  onViewContracts,
  onViewPaymentHistory,
  onToggleWhatsApp,
  onUnblockWhatsApp,
}: ClientRowProps) {
  return (
    <TableRow className="hover:bg-muted/50 transition-colors">
      <TableCell className="min-w-[180px]">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {getInitials(client.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-foreground truncate max-w-[130px]">{client.name}</p>
              {client.is_courtesy && (
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] px-1.5 py-0 h-4">
                  <Gift className="w-2.5 h-2.5 mr-0.5" />
                  Cortesia
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate max-w-[160px]">
              {client.document || 'Sem documento'}
            </p>
          </div>
        </div>
      </TableCell>

      <TableCell className="hidden md:table-cell min-w-[160px]">
        <div className="space-y-1">
          <div className="flex items-center text-sm text-muted-foreground">
            <Mail className="w-3 h-3 mr-1.5 shrink-0" />
            <span className="truncate max-w-[140px]">{client.email || 'Não informado'}</span>
          </div>
          <div className="flex items-center text-sm text-muted-foreground gap-1.5">
            <Phone className="w-3 h-3 shrink-0" />
            <span>{client.phone}</span>
            <TooltipProvider>
              {client.whatsapp_opt_out && (
                <Tooltip>
                  <TooltipTrigger>
                    <MessageSquareOff className="w-3.5 h-3.5 text-destructive" />
                  </TooltipTrigger>
                  <TooltipContent>WhatsApp desabilitado manualmente</TooltipContent>
                </Tooltip>
              )}
              {client.whatsapp_blocked && !client.whatsapp_opt_out && (
                <Tooltip>
                  <TooltipTrigger>
                    <Ban className="w-3.5 h-3.5 text-warning" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Bloqueado: {client.whatsapp_block_reason || 'Múltiplas falhas'}
                  </TooltipContent>
                </Tooltip>
              )}
              {!client.whatsapp_opt_out && !client.whatsapp_blocked && (
                <Tooltip>
                  <TooltipTrigger>
                    <MessageSquare className="w-3.5 h-3.5 text-success" />
                  </TooltipTrigger>
                  <TooltipContent>WhatsApp ativo</TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        </div>
      </TableCell>

      <TableCell className="w-20 text-center">
        <ClientScoreBadge
          score={score?.score}
          totalPayments={score?.total_payments}
          paidOnTime={score?.paid_on_time}
          paidLate={score?.paid_late}
          overdueCount={score?.overdue_count}
          avgDaysLate={score?.avg_days_late}
          size="sm"
        />
      </TableCell>

      <TableCell className="w-24 text-center">
        <ClientStatus status={client.status} />
      </TableCell>

      <TableCell className="w-16 text-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Ações</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onView(client.id)}>
              <Eye className="w-4 h-4 mr-2" />
              Visualizar cliente
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEdit(client.id)}>
              <Edit className="w-4 h-4 mr-2" />
              Editar cliente
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onViewContracts(client.id)}>
              <FileText className="w-4 h-4 mr-2" />
              Ver contratos
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onViewPaymentHistory(client.id)}>
              <History className="w-4 h-4 mr-2" />
              Histórico de pagamentos
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onToggleWhatsApp(client.id, client.whatsapp_opt_out)}>
              {client.whatsapp_opt_out ? (
                <>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Habilitar WhatsApp
                </>
              ) : (
                <>
                  <MessageSquareOff className="w-4 h-4 mr-2" />
                  Desabilitar WhatsApp
                </>
              )}
            </DropdownMenuItem>
            {client.whatsapp_blocked && (
              <DropdownMenuItem onSelect={() => onUnblockWhatsApp(client.id)}>
                <Unlock className="w-4 h-4 mr-2" />
                Desbloquear WhatsApp
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() => onDelete(client.id, client.name)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir cliente
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
