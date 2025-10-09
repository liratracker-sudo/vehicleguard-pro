import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAsaas } from "@/hooks/useAsaas"
import { Search } from "lucide-react"

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

function ptStatus(status?: string) {
  switch (status) {
    case 'PENDING': return 'Pendente'
    case 'OVERDUE': return 'Vencido'
    case 'RECEIVED':
    case 'CONFIRMED': return 'Pago'
    default: return status ?? '-'
  }
}

export function AsaasCpfLookup() {
  const [cpf, setCpf] = useState("")
  const [results, setResults] = useState<any[] | null>(null)
  const [message, setMessage] = useState<string>("")
  const { findChargesByCpf, loading } = useAsaas()

  const onSearch = async () => {
    setMessage("")
    setResults(null)
    const digits = cpf.replace(/\D/g, '')
    if (digits.length !== 11) {
      setMessage('Informe um CPF válido com 11 dígitos')
      return
    }
    try {
      const res = await findChargesByCpf(digits)
      if (res.customerFound === false) {
        setMessage('Nenhuma cobrança encontrada para este CPF')
        setResults([])
      } else {
        setResults(res.charges || [])
      }
    } catch (e) {
      // Mensagem já exibida pelo hook
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consultar cobranças por CPF (Asaas)</CardTitle>
        <CardDescription>
          Busque diretamente no Asaas por cobranças ativas, pendentes ou vencidas usando o CPF do cliente
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
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Pagamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>R$ {(p.value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>{ptStatus(p.status)}</TableCell>
                      <TableCell>{p.dueDate ? p.dueDate.split('T')[0].split('-').reverse().join('/') : '-'}</TableCell>
                      <TableCell>
                        {p.invoiceUrl || p.bankSlipUrl ? (
                          <a
                            href={p.invoiceUrl || p.bankSlipUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline"
                          >
                            Link de pagamento
                          </a>
                        ) : p.pixQrCodeUrl ? (
                          <a
                            href={p.pixQrCodeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline"
                          >
                            QRCode PIX
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}
