import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface CompanySubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string | null
  companyName: string
  currentSubscription?: any
  onSaved: () => void
}

export function CompanySubscriptionDialog({ 
  open, 
  onOpenChange, 
  companyId, 
  companyName, 
  currentSubscription, 
  onSaved 
}: CompanySubscriptionDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [plans, setPlans] = useState<any[]>([])
  const [formData, setFormData] = useState({
    plan_id: '',
    status: 'active',
    auto_renew: true
  })

  useEffect(() => {
    if (open) {
      loadPlans()
    }
  }, [open])

  useEffect(() => {
    if (currentSubscription) {
      setFormData({
        plan_id: currentSubscription.plan_id || '',
        status: currentSubscription.status || 'active',
        auto_renew: currentSubscription.auto_renew ?? true
      })
    } else {
      setFormData({
        plan_id: '',
        status: 'active',
        auto_renew: true
      })
    }
  }, [currentSubscription])

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, price_monthly, is_active')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true })

      if (error) throw error
      setPlans(data || [])
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId || !formData.plan_id) return
    
    setLoading(true)

    try {
      if (currentSubscription) {
        // Atualizar assinatura existente
        const { error } = await supabase
          .from('company_subscriptions')
          .update({
            plan_id: formData.plan_id,
            status: formData.status,
            auto_renew: formData.auto_renew
          })
          .eq('company_id', companyId)

        if (error) throw error
      } else {
        // Criar nova assinatura
        const { error } = await supabase
          .from('company_subscriptions')
          .insert([{
            company_id: companyId,
            plan_id: formData.plan_id,
            status: formData.status,
            auto_renew: formData.auto_renew,
            started_at: new Date().toISOString()
          }])

        if (error) throw error
      }

      toast({
        title: "Sucesso",
        description: "Assinatura da empresa atualizada com sucesso"
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assinatura da Empresa</DialogTitle>
          <DialogDescription>
            Configure o plano de assinatura para {companyName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="plan_id">Plano *</Label>
            <Select
              value={formData.plan_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, plan_id: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} - {formatCurrency(plan.price_monthly)}/mês
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="status">Status *</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="auto_renew"
              checked={formData.auto_renew}
              onCheckedChange={(checked) => setFormData(prev => ({ 
                ...prev, 
                auto_renew: checked 
              }))}
            />
            <Label htmlFor="auto_renew">Renovação automática</Label>
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
            <Button type="submit" disabled={loading || !formData.plan_id}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}