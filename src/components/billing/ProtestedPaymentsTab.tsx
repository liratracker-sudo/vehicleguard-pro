import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ModernStatCard } from "@/components/ui/modern-stat-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Scale, 
  Search, 
  MoreHorizontal, 
  Handshake, 
  PhoneCall, 
  MessageSquare,
  Undo2,
  FileX,
  Ban,
  Lock,
  History,
  Users,
  TrendingUp,
  RefreshCw
} from "lucide-react"
import { formatDateBR, daysUntil } from "@/lib/timezone"
import { useBillingManagement } from "@/hooks/useBillingManagement"
import { NegotiationDialog } from "./NegotiationDialog"
import { ContactLogDialog } from "./ContactLogDialog"
import { ContactHistoryDialog } from "./ContactHistoryDialog"

interface ProtestedPayment {
  id: string
  amount: number
  due_date: string
  protested_at: string
  days_protested: number
  days_overdue: number
  client_id: string
  client_name: string
  client_phone: string
  client_email: string | null
  client_document: string | null
  client_service_status: string | null
  notes?: string
}

export function ProtestedPaymentsTab() {
  const [payments, setPayments] = useState<ProtestedPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [periodFilter, setPeriodFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("protested_at")
  const [selectedPayment, setSelectedPayment] = useState<ProtestedPayment | null>(null)
  const [showNegotiationDialog, setShowNegotiationDialog] = useState(false)
  const [showContactDialog, setShowContactDialog] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const { toast } = useToast()
  const { undoProtest } = useBillingManagement()

  useEffect(() => {
    loadProtestedPayments()
  }, [])

  const loadProtestedPayments = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile) return

      const { data, error } = await supabase
        .from('payment_transactions')
        .select(`
          id,
          amount,
          due_date,
          protested_at,
          description,
          clients (
            id,
            name,
            phone,
            email,
            document,
            service_status
          )
        `)
        .eq('company_id', profile.company_id)
        .not('protested_at', 'is', null)
        .neq('status', 'paid')
        .order('protested_at', { ascending: false })

      if (error) throw error

      const now = new Date()
      const mapped: ProtestedPayment[] = (data || []).map(p => {
        const protestedDate = new Date(p.protested_at!)
        const dueDate = new Date(p.due_date)
        const daysProtested = Math.floor((now.getTime() - protestedDate.getTime()) / (1000 * 60 * 60 * 24))
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

        return {
          id: p.id,
          amount: p.amount,
          due_date: p.due_date,
          protested_at: p.protested_at!,
          days_protested: daysProtested,
          days_overdue: daysOverdue,
          client_id: p.clients?.id || '',
          client_name: p.clients?.name || 'Desconhecido',
          client_phone: p.clients?.phone || '',
          client_email: p.clients?.email,
          client_document: p.clients?.document,
          client_service_status: p.clients?.service_status,
          notes: p.description
        }
      })

      setPayments(mapped)
    } catch (error) {
      console.error('Error loading protested payments:', error)
      toast({
        title: "Erro ao carregar protestos",
        description: "Não foi possível carregar a lista de pagamentos protestados.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUndoProtest = async (payment: ProtestedPayment) => {
    try {
      await undoProtest(payment.id)
      loadProtestedPayments()
    } catch (error) {
      console.error('Error undoing protest:', error)
    }
  }

  const handleSuspendService = async (payment: ProtestedPayment) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ service_status: 'suspended' })
        .eq('id', payment.client_id)

      if (error) throw error

      toast({
        title: "Serviço suspenso",
        description: `O serviço do cliente ${payment.client_name} foi suspenso.`
      })
      loadProtestedPayments()
    } catch (error) {
      console.error('Error suspending service:', error)
      toast({
        title: "Erro ao suspender serviço",
        variant: "destructive"
      })
    }
  }

  const handleBlockClient = async (payment: ProtestedPayment) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ status: 'blocked', service_status: 'blocked' })
        .eq('id', payment.client_id)

      if (error) throw error

      toast({
        title: "Cliente bloqueado",
        description: `O cliente ${payment.client_name} foi bloqueado.`
      })
      loadProtestedPayments()
    } catch (error) {
      console.error('Error blocking client:', error)
      toast({
        title: "Erro ao bloquear cliente",
        variant: "destructive"
      })
    }
  }

  const handleWriteOff = async (payment: ProtestedPayment) => {
    try {
      const { error } = await supabase
        .from('payment_transactions')
        .update({ 
          status: 'cancelled',
          notes: `Baixa por perda - ${payment.notes || ''} | Protestado em ${formatDateBR(payment.protested_at)}`
        })
        .eq('id', payment.id)

      if (error) throw error

      toast({
        title: "Baixa por perda",
        description: "O pagamento foi marcado como perda e removido dos protestos."
      })
      loadProtestedPayments()
    } catch (error) {
      console.error('Error writing off payment:', error)
      toast({
        title: "Erro ao dar baixa",
        variant: "destructive"
      })
    }
  }

  const sendWhatsAppNegotiation = (payment: ProtestedPayment) => {
    const message = encodeURIComponent(
      `Olá ${payment.client_name.split(' ')[0]}, ` +
      `identificamos uma pendência no valor de R$ ${payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. ` +
      `Gostaríamos de oferecer condições especiais para regularização. Podemos conversar?`
    )
    window.open(`https://wa.me/55${payment.client_phone.replace(/\D/g, '')}?text=${message}`, '_blank')
  }

  // Filtrar pagamentos
  const filteredPayments = payments.filter(p => {
    // Filtro de busca
    if (search) {
      const searchLower = search.toLowerCase()
      if (!p.client_name.toLowerCase().includes(searchLower) &&
          !p.client_document?.toLowerCase().includes(searchLower)) {
        return false
      }
    }

    // Filtro de período
    if (periodFilter !== "all") {
      const days = parseInt(periodFilter)
      if (p.days_protested > days) return false
    }

    // Filtro de status do cliente
    if (statusFilter !== "all") {
      if (p.client_service_status !== statusFilter) return false
    }

    return true
  })

  // Ordenar
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    switch (sortBy) {
      case "amount":
        return b.amount - a.amount
      case "days_overdue":
        return b.days_overdue - a.days_overdue
      case "protested_at":
      default:
        return new Date(b.protested_at).getTime() - new Date(a.protested_at).getTime()
    }
  })

  // Calcular estatísticas
  const stats = {
    totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
    clientCount: new Set(payments.map(p => p.client_id)).size,
    maxDebt: payments.length > 0 ? Math.max(...payments.map(p => p.amount)) : 0,
    recovered: 0 // Implementar depois com histórico
  }

  const getServiceStatusBadge = (status: string | null) => {
    switch (status) {
      case 'suspended':
        return <Badge className="bg-orange-500 text-white border-0">Suspenso</Badge>
      case 'blocked':
        return <Badge className="bg-red-600 text-white border-0">Bloqueado</Badge>
      default:
        return <Badge className="bg-emerald-500 text-white border-0">Ativo</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Cards de Resumo */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <ModernStatCard
          title="Total Protestado"
          value={`R$ ${stats.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<Scale className="h-5 w-5" />}
          variant="danger"
          className="py-2"
        />
        <ModernStatCard
          title="Clientes"
          value={stats.clientCount.toString()}
          icon={<Users className="h-5 w-5" />}
          variant="default"
          className="py-2"
        />
        <ModernStatCard
          title="Maior Dívida"
          value={`R$ ${stats.maxDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<TrendingUp className="h-5 w-5" />}
          variant="warning"
          className="py-2"
        />
        <ModernStatCard
          title="Recuperados"
          value={`R$ ${stats.recovered.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<RefreshCw className="h-5 w-5" />}
          variant="success"
          className="py-2"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="60">Últimos 60 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="suspended">Suspensos</SelectItem>
            <SelectItem value="blocked">Bloqueados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="protested_at">Data do Protesto</SelectItem>
            <SelectItem value="amount">Maior Valor</SelectItem>
            <SelectItem value="days_overdue">Mais Atrasado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">Cliente</TableHead>
              <TableHead className="font-semibold text-right">Valor</TableHead>
              <TableHead className="font-semibold">Vencimento</TableHead>
              <TableHead className="font-semibold">Protestado em</TableHead>
              <TableHead className="font-semibold">Tempo</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Scale className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Nenhum pagamento protestado</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedPayments.map((payment) => (
                <TableRow key={payment.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div>
                      <p className="font-medium">{payment.client_name}</p>
                      {payment.client_document && (
                        <p className="text-xs text-muted-foreground">
                          {payment.client_document.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.**$4')}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-red-600">
                    R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateBR(payment.due_date)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateBR(payment.protested_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {payment.days_protested}d
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {getServiceStatusBadge(payment.client_service_status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => {
                          setSelectedPayment(payment)
                          setShowNegotiationDialog(true)
                        }}>
                          <Handshake className="h-4 w-4 mr-2" />
                          Negociar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setSelectedPayment(payment)
                          setShowContactDialog(true)
                        }}>
                          <PhoneCall className="h-4 w-4 mr-2" />
                          Registrar Contato
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => sendWhatsAppNegotiation(payment)}>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          WhatsApp Negociação
                        </DropdownMenuItem>
                        
                        <DropdownMenuSeparator />
                        
                        <DropdownMenuItem onClick={() => {
                          setSelectedPayment(payment)
                          setShowHistoryDialog(true)
                        }}>
                          <History className="h-4 w-4 mr-2" />
                          Ver Histórico
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUndoProtest(payment)}>
                          <Undo2 className="h-4 w-4 mr-2" />
                          Desfazer Protesto
                        </DropdownMenuItem>
                        
                        <DropdownMenuSeparator />
                        
                        <DropdownMenuItem 
                          onClick={() => handleWriteOff(payment)}
                          className="text-orange-600 focus:text-orange-600"
                        >
                          <FileX className="h-4 w-4 mr-2" />
                          Baixa por Perda
                        </DropdownMenuItem>
                        {payment.client_service_status !== 'suspended' && (
                          <DropdownMenuItem 
                            onClick={() => handleSuspendService(payment)}
                            className="text-orange-600 focus:text-orange-600"
                          >
                            <Ban className="h-4 w-4 mr-2" />
                            Suspender Serviço
                          </DropdownMenuItem>
                        )}
                        {payment.client_service_status !== 'blocked' && (
                          <DropdownMenuItem 
                            onClick={() => handleBlockClient(payment)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Lock className="h-4 w-4 mr-2" />
                            Bloquear Cliente
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      {selectedPayment && (
        <>
          <NegotiationDialog
            open={showNegotiationDialog}
            onOpenChange={setShowNegotiationDialog}
            payment={selectedPayment}
            onSuccess={loadProtestedPayments}
          />
          <ContactLogDialog
            open={showContactDialog}
            onOpenChange={setShowContactDialog}
            payment={selectedPayment}
            onSuccess={loadProtestedPayments}
          />
          <ContactHistoryDialog
            open={showHistoryDialog}
            onOpenChange={setShowHistoryDialog}
            payment={selectedPayment}
          />
        </>
      )}
    </div>
  )
}
