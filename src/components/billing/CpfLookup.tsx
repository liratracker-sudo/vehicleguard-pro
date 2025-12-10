import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateBR } from "@/lib/timezone"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

function formatCpf(value: string) {
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

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    'pending': 'Pendente',
    'paid': 'Pago',
    'overdue': 'Vencido',
    'cancelled': 'Cancelado'
  }
  return labels[status] || status
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case 'paid':
      return 'default'
    case 'pending':
      return 'secondary'
    case 'overdue':
      return 'destructive'
    default:
      return 'outline'
  }
}

export function CpfLookup() {
  const [cpf, setCpf] = useState("")
  const [results, setResults] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string>("")
  const { toast } = useToast()

  const onSearch = async () => {
    setMessage("")
    setResults(null)
    const digits = cpf.replace(/\D/g, '')
    
    if (digits.length !== 11) {
      setMessage('Informe um CPF válido com 11 dígitos')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar autenticado",
          variant: "destructive"
        })
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile) {
        toast({
          title: "Erro",
          description: "Perfil não encontrado",
          variant: "destructive"
        })
        return
      }

      // Buscar cliente pelo CPF
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, name')
        .eq('company_id', profile.company_id)
        .eq('document', digits)
        .maybeSingle()

      if (clientError) throw clientError

      if (!client) {
        setMessage('Nenhum cliente encontrado com este CPF')
        setResults([])
        return
      }

      // Buscar cobranças do cliente
      const { data: payments, error: paymentsError } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })

      if (paymentsError) throw paymentsError

      if (!payments || payments.length === 0) {
        setMessage(`Cliente ${client.name} encontrado, mas sem cobranças`)
        setResults([])
        return
      }

      setResults(payments.map(p => ({
        ...p,
        clientName: client.name
      })))
    } catch (error: any) {
      console.error('Error searching by CPF:', error)
      toast({
        title: "Erro na busca",
        description: error.message || "Erro ao buscar cobranças",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consultar cobranças por CPF</CardTitle>
        <CardDescription>
          Busque todas as cobranças de um cliente usando o CPF (todos os gateways de pagamento)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Digite o CPF do cliente"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            inputMode="numeric"
            maxLength={14}
          />
          <Button onClick={onSearch} disabled={loading}>
            <Search className={`w-4 h-4 mr-2 ${loading ? 'animate-pulse' : ''}`} />
            Buscar
          </Button>
        </div>

        {message && (
          <div className="text-sm text-muted-foreground">{message}</div>
        )}

        {results && (
          results.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma cobrança encontrada</div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm font-medium">
                Cliente: {results[0].clientName} - {results.length} cobrança(s) encontrada(s)
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Gateway</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          R$ {Number(p.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(p.status)}>
                            {getStatusLabel(p.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">
                          {p.payment_gateway || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {p.due_date ? formatDateBR(p.due_date) : '-'}
                        </TableCell>
                        <TableCell>
                          {formatDateBR(p.created_at)}
                        </TableCell>
                        <TableCell>
                          {p.payment_url ? (
                            <a
                              href={p.payment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline hover:text-primary/80"
                            >
                              Abrir
                            </a>
                          ) : p.pix_code ? (
                            <span className="text-xs text-muted-foreground">PIX disponível</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}
