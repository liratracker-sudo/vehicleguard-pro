import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Plus, Settings, Trash2, CreditCard, Users, Car, Database, Zap } from "lucide-react"

interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price_monthly: number
  price_yearly: number
  max_vehicles: number
  max_users: number
  max_messages_per_month: number
  max_api_calls_per_day: number
  max_storage_mb: number
  features: string[]
  is_active: boolean
  created_at: string
}

export function SubscriptionPlansManagement() {
  const { toast } = useToast()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_monthly: 0,
    price_yearly: 0,
    max_vehicles: 100,
    max_users: 10,
    max_messages_per_month: 1000,
    max_api_calls_per_day: 10000,
    max_storage_mb: 1000,
    features: [] as string[],
    is_active: true
  })
  const [featuresText, setFeaturesText] = useState('')

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price_monthly', { ascending: true })

      if (error) throw error
      
      // Converter dados para o tipo correto
      const formattedPlans = (data || []).map(plan => ({
        ...plan,
        description: plan.description || '',
        max_vehicles: plan.max_vehicles || 0,
        max_users: plan.max_users || 0,
        max_messages_per_month: plan.max_messages_per_month || 0,
        max_api_calls_per_day: plan.max_api_calls_per_day || 0,
        max_storage_mb: plan.max_storage_mb || 0,
        features: Array.isArray(plan.features) 
          ? plan.features.filter((f): f is string => typeof f === 'string')
          : []
      }))
      
      setPlans(formattedPlans)
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

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price_monthly: 0,
      price_yearly: 0,
      max_vehicles: 100,
      max_users: 10,
      max_messages_per_month: 1000,
      max_api_calls_per_day: 10000,
      max_storage_mb: 1000,
      features: [],
      is_active: true
    })
    setFeaturesText('')
    setEditingPlan(null)
  }

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan)
    setFormData({
      name: plan.name,
      description: plan.description || '',
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      max_vehicles: plan.max_vehicles || 100,
      max_users: plan.max_users || 10,
      max_messages_per_month: plan.max_messages_per_month || 1000,
      max_api_calls_per_day: plan.max_api_calls_per_day || 10000,
      max_storage_mb: plan.max_storage_mb || 1000,
      features: plan.features || [],
      is_active: plan.is_active
    })
    setFeaturesText((plan.features || []).join('\n'))
    setShowDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const features = featuresText.split('\n').filter(f => f.trim() !== '')
      const planData = { ...formData, features }

      if (editingPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(planData)
          .eq('id', editingPlan.id)

        if (error) throw error

        toast({
          title: "Sucesso",
          description: "Plano atualizado com sucesso"
        })
      } else {
        const { error } = await supabase
          .from('subscription_plans')
          .insert([planData])

        if (error) throw error

        toast({
          title: "Sucesso",
          description: "Plano criado com sucesso"
        })
      }

      setShowDialog(false)
      resetForm()
      loadPlans()
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  const togglePlanStatus = async (planId: string, newStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update({ is_active: newStatus })
        .eq('id', planId)

      if (error) throw error

      toast({
        title: "Sucesso",
        description: `Plano ${newStatus ? 'ativado' : 'desativado'} com sucesso`
      })

      loadPlans()
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  const deletePlan = async (planId: string) => {
    if (!confirm('Tem certeza que deseja excluir este plano?')) return

    try {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', planId)

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Plano excluído com sucesso"
      })

      loadPlans()
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    loadPlans()
  }, [])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gestão de Planos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Gestão de Planos de Assinatura
              </CardTitle>
              <CardDescription>
                Crie e gerencie os planos de assinatura do sistema
              </CardDescription>
            </div>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={resetForm}>
                  <Plus className="w-4 h-4" />
                  Novo Plano
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingPlan ? 'Editar Plano' : 'Novo Plano'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingPlan 
                      ? 'Edite as informações do plano de assinatura'
                      : 'Crie um novo plano de assinatura para o sistema'
                    }
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Nome do Plano *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Plano Básico"
                        required
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                      />
                      <Label htmlFor="is_active">Plano ativo</Label>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descrição do plano"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="price_monthly">Preço Mensal (R$) *</Label>
                      <Input
                        id="price_monthly"
                        type="number"
                        step="0.01"
                        value={formData.price_monthly}
                        onChange={(e) => setFormData(prev => ({ ...prev, price_monthly: parseFloat(e.target.value) || 0 }))}
                        placeholder="99.90"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="price_yearly">Preço Anual (R$) *</Label>
                      <Input
                        id="price_yearly"
                        type="number"
                        step="0.01"
                        value={formData.price_yearly}
                        onChange={(e) => setFormData(prev => ({ ...prev, price_yearly: parseFloat(e.target.value) || 0 }))}
                        placeholder="999.90"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="max_vehicles">Máximo de Veículos</Label>
                      <Input
                        id="max_vehicles"
                        type="number"
                        value={formData.max_vehicles}
                        onChange={(e) => setFormData(prev => ({ ...prev, max_vehicles: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="max_users">Máximo de Usuários</Label>
                      <Input
                        id="max_users"
                        type="number"
                        value={formData.max_users}
                        onChange={(e) => setFormData(prev => ({ ...prev, max_users: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="max_messages_per_month">Mensagens/Mês</Label>
                      <Input
                        id="max_messages_per_month"
                        type="number"
                        value={formData.max_messages_per_month}
                        onChange={(e) => setFormData(prev => ({ ...prev, max_messages_per_month: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="max_api_calls_per_day">API Calls/Dia</Label>
                      <Input
                        id="max_api_calls_per_day"
                        type="number"
                        value={formData.max_api_calls_per_day}
                        onChange={(e) => setFormData(prev => ({ ...prev, max_api_calls_per_day: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="max_storage_mb">Storage (MB)</Label>
                      <Input
                        id="max_storage_mb"
                        type="number"
                        value={formData.max_storage_mb}
                        onChange={(e) => setFormData(prev => ({ ...prev, max_storage_mb: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="features">Funcionalidades (uma por linha)</Label>
                    <Textarea
                      id="features"
                      value={featuresText}
                      onChange={(e) => setFeaturesText(e.target.value)}
                      placeholder="Dashboard completo&#10;Relatórios avançados&#10;Suporte prioritário"
                      rows={5}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingPlan ? 'Atualizar' : 'Criar'} Plano
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead>Preços</TableHead>
                  <TableHead>Limites</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{plan.name}</div>
                        <div className="text-sm text-muted-foreground">{plan.description}</div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {plan.features?.slice(0, 3).map((feature, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                          {plan.features?.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{plan.features.length - 3} mais
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium">{formatCurrency(plan.price_monthly)}</span>
                          <span className="text-xs text-muted-foreground">/mês</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm">{formatCurrency(plan.price_yearly)}</span>
                          <span className="text-xs text-muted-foreground">/ano</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-1">
                          <Car className="w-3 h-3" />
                          <span>{plan.max_vehicles || 0} veículos</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{plan.max_users || 0} usuários</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          <span>{plan.max_messages_per_month || 0} msgs/mês</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Database className="w-3 h-3" />
                          <span>{plan.max_storage_mb || 0} MB</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={plan.is_active}
                          onCheckedChange={(checked) => togglePlanStatus(plan.id, checked)}
                        />
                        <span className="text-sm">
                          {plan.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(plan)}
                          className="gap-2"
                        >
                          <Settings className="w-4 h-4" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deletePlan(plan.id)}
                          className="gap-2 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {plans.length === 0 && (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  Nenhum plano cadastrado
                </h3>
                <p className="text-sm text-muted-foreground">
                  Crie planos de assinatura para suas empresas
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}