import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Search, ArrowRight } from "lucide-react"

interface TransferVehicleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle: any | null
  onSuccess?: () => void
}

export function TransferVehicleDialog({ open, onOpenChange, vehicle, onSuccess }: TransferVehicleDialogProps) {
  const { toast } = useToast()
  const [clients, setClients] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setSearch("")
    setSelectedClientId("")
    setNotes("")
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('user_id', user.id).maybeSingle()
      if (!profile?.company_id) return
      const { data } = await supabase
        .from('clients')
        .select('id, name, phone, document')
        .eq('company_id', profile.company_id)
        .order('name')
      setClients(data || [])
    })()
  }, [open])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const list = clients.filter(c => c.id !== vehicle?.client_id)
    if (!q) return list.slice(0, 50)
    return list.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.document?.toLowerCase().includes(q)
    ).slice(0, 50)
  }, [clients, search, vehicle])

  const handleTransfer = async () => {
    if (!vehicle || !selectedClientId) return
    setSaving(true)
    try {
      const previousNotes = vehicle.notes || ""
      const stamp = new Date().toLocaleString('pt-BR')
      const fromName = vehicle.clients?.name || 'cliente anterior'
      const toClient = clients.find(c => c.id === selectedClientId)
      const transferNote = `[${stamp}] Transferido de ${fromName} para ${toClient?.name}${notes ? ` — ${notes}` : ''}`
      const newNotes = previousNotes ? `${previousNotes}\n${transferNote}` : transferNote

      const { error } = await supabase
        .from('vehicles')
        .update({ client_id: selectedClientId, notes: newNotes })
        .eq('id', vehicle.id)

      if (error) throw error

      toast({
        title: "Veículo transferido",
        description: `${vehicle.license_plate} agora pertence a ${toClient?.name}`
      })
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error('Erro ao transferir veículo:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao transferir veículo",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transferir veículo</DialogTitle>
          <DialogDescription>
            {vehicle && (
              <span className="flex items-center gap-2 flex-wrap">
                <strong>{vehicle.license_plate}</strong>
                <span className="text-muted-foreground">{vehicle.brand} {vehicle.model}</span>
                <span className="text-muted-foreground">de</span>
                <strong>{vehicle.clients?.name || '—'}</strong>
                <ArrowRight className="w-4 h-4" />
                <span className="text-muted-foreground">novo cliente</span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Buscar cliente</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome, telefone ou documento"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="border rounded-md max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Nenhum cliente encontrado</div>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedClientId(c.id)}
                  className={`w-full text-left px-4 py-2 border-b last:border-b-0 hover:bg-muted transition-colors ${selectedClientId === c.id ? 'bg-muted' : ''}`}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.phone} {c.document ? `• ${c.document}` : ''}</div>
                </button>
              ))
            )}
          </div>

          <div>
            <Label>Observações (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Motivo da transferência, valor de venda, etc."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleTransfer} disabled={!selectedClientId || saving}>
            {saving ? 'Transferindo...' : 'Confirmar transferência'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
