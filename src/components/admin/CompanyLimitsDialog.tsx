import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface CompanyLimitsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string | null
  companyName: string
  currentLimits?: any
  onSaved: () => void
}

export function CompanyLimitsDialog({ 
  open, 
  onOpenChange, 
  companyId, 
  companyName, 
  currentLimits, 
  onSaved 
}: CompanyLimitsDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    max_vehicles: 100,
    max_users: 10,
    max_messages_per_month: 1000,
    max_api_calls_per_day: 10000,
    max_storage_mb: 1000,
    is_active: true
  })

  useEffect(() => {
    if (currentLimits) {
      setFormData({
        max_vehicles: currentLimits.max_vehicles || 100,
        max_users: currentLimits.max_users || 10,
        max_messages_per_month: currentLimits.max_messages_per_month || 1000,
        max_api_calls_per_day: currentLimits.max_api_calls_per_day || 10000,
        max_storage_mb: currentLimits.max_storage_mb || 1000,
        is_active: currentLimits.is_active ?? true
      })
    }
  }, [currentLimits])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return
    
    setLoading(true)

    try {
      // Verificar se já existem limites para a empresa
      const { data: existingLimits } = await supabase
        .from('company_limits')
        .select('id')
        .eq('company_id', companyId)
        .single()

      if (existingLimits) {
        // Atualizar limites existentes
        const { error } = await supabase
          .from('company_limits')
          .update(formData)
          .eq('company_id', companyId)

        if (error) throw error
      } else {
        // Criar novos limites
        const { error } = await supabase
          .from('company_limits')
          .insert([{ ...formData, company_id: companyId }])

        if (error) throw error
      }

      toast({
        title: "Sucesso",
        description: "Limites da empresa atualizados com sucesso"
      })

      onSaved()
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Limites da Empresa</DialogTitle>
          <DialogDescription>
            Configure os limites de uso para {companyName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="max_vehicles">Máximo de Veículos</Label>
            <Input
              id="max_vehicles"
              type="number"
              value={formData.max_vehicles}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                max_vehicles: parseInt(e.target.value) || 0 
              }))}
              min="0"
            />
          </div>

          <div>
            <Label htmlFor="max_users">Máximo de Usuários</Label>
            <Input
              id="max_users"
              type="number"
              value={formData.max_users}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                max_users: parseInt(e.target.value) || 0 
              }))}
              min="0"
            />
          </div>

          <div>
            <Label htmlFor="max_messages_per_month">Mensagens por Mês</Label>
            <Input
              id="max_messages_per_month"
              type="number"
              value={formData.max_messages_per_month}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                max_messages_per_month: parseInt(e.target.value) || 0 
              }))}
              min="0"
            />
          </div>

          <div>
            <Label htmlFor="max_api_calls_per_day">Chamadas API por Dia</Label>
            <Input
              id="max_api_calls_per_day"
              type="number"
              value={formData.max_api_calls_per_day}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                max_api_calls_per_day: parseInt(e.target.value) || 0 
              }))}
              min="0"
            />
          </div>

          <div>
            <Label htmlFor="max_storage_mb">Armazenamento (MB)</Label>
            <Input
              id="max_storage_mb"
              type="number"
              value={formData.max_storage_mb}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                max_storage_mb: parseInt(e.target.value) || 0 
              }))}
              min="0"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="limits_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ 
                ...prev, 
                is_active: checked 
              }))}
            />
            <Label htmlFor="limits_active">Aplicar limites</Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}