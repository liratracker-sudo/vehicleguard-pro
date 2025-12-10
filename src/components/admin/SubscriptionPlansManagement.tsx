import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Plus, Settings, Trash2, CreditCard, Users, Car, Database, Zap, Star, Crown, Sparkles, MessageSquare, Check, Loader2 } from "lucide-react"

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

const EXAMPLE_PLANS = [
  {
    name: "Starter",
    description: "Ideal para pequenas operações de rastreamento",
    price_monthly: 49.90,
    price_yearly: 479.00,
    max_vehicles: 50,
    max_users: 2,
    max_messages_per_month: 500,
    max_api_calls_per_day: 5000,
    max_storage_mb: 500,
    features: [
      "Dashboard básico",
      "Relatórios simples",
      "Suporte por email",
      "1 integração de pagamento"
    ],
    is_active: true
  },
  {
    name: "Básico",
    description: "Para empresas em crescimento",
    price_monthly: 59.90,
    price_yearly: 599.00,
    max_vehicles: 100,
    max_users: 3,
    max_messages_per_month: 1000,
    max_api_calls_per_day: 10000,
    max_storage_mb: 1000,
    features: [
      "Dashboard completo",
      "Relatórios avançados",
      "Notificações WhatsApp básicas",
      "2 integrações de pagamento",
      "Suporte prioritário"
    ],
    is_active: true
  },
  {
    name: "Profissional",
    description: "Recursos completos para gestão profissional",
    price_monthly: 99.90,
    price_yearly: 999.00,
    max_vehicles: 250,
    max_users: 5,
    max_messages_per_month: 2500,
    max_api_calls_per_day: 25000,
    max_storage_mb: 2500,
    features: [
      "Dashboard completo",
      "Cobrança com IA",
      "📊 Relatórios WhatsApp para Gestor",
      "Todas integrações de pagamento",
      "Contratos digitais",
      "API completa",
      "Suporte 24h"
    ],
    is_active: true
  },
  {
    name: "Empresarial",
    description: "Para operações de médio porte",
    price_monthly: 199.90,
    price_yearly: 1999.00,
    max_vehicles: 500,
    max_users: 10,
    max_messages_per_month: 5000,
    max_api_calls_per_day: 50000,
    max_storage_mb: 5000,
    features: [
      "Todas funcionalidades do Profissional",
      "📊 Relatórios WhatsApp para Gestor",
      "White-label básico",
      "Relatórios personalizados",
      "Múltiplas contas bancárias",
      "Gerente de conta dedicado"
    ],
    is_active: true
  },
  {
    name: "Enterprise",
    description: "Solução completa para grandes operações",
    price_monthly: 349.90,
    price_yearly: 3499.00,
    max_vehicles: 1000,
    max_users: 20,
    max_messages_per_month: 10000,
    max_api_calls_per_day: 100000,
    max_storage_mb: 10000,
    features: [
      "Todas funcionalidades do Empresarial",
      "📊 Relatórios WhatsApp para Gestor",
      "White-label completo",
      "Domínio personalizado",
      "SLA garantido 99.9%",
      "Suporte 24/7"
    ],
    is_active: true
  },
  {
    name: "Ilimitado",
    description: "Sem limites para grandes corporações",
    price_monthly: 599.90,
    price_yearly: 5999.00,
    max_vehicles: 999999,
    max_users: 999999,
    max_messages_per_month: 999999,
    max_api_calls_per_day: 999999,
    max_storage_mb: 100000,
    features: [
      "Todas funcionalidades sem limites",
      "📊 Relatórios WhatsApp para Gestor",
      "Infraestrutura dedicada",
      "Customizações exclusivas",
      "Treinamento da equipe",
      "Consultoria mensal",
      "Prioridade em novas features"
    ],
    is_active: true
  }
]

const PLAN_TIERS = {
  'Starter': { color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30', icon: Car },
  'Básico': { color: 'bg-blue-500/10 text-blue-500 border-blue-500/30', icon: Car },
  'Profissional': { color: 'bg-violet-500/10 text-violet-500 border-violet-500/30', icon: Star, popular: true },
  'Empresarial': { color: 'bg-amber-500/10 text-amber-500 border-amber-500/30', icon: Crown },
  'Enterprise': { color: 'bg-rose-500/10 text-rose-500 border-rose-500/30', icon: Crown },
  'Ilimitado': { color: 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-500 border-purple-500/30', icon: Sparkles }
}

export function SubscriptionPlansManagement() {
  const { toast } = useToast()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingExamples, setCreatingExamples] = useState(false)
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

  const createExamplePlans = async () => {
    if (!confirm('Isso irá criar 6 planos de exemplo. Deseja continuar?')) return
    
    setCreatingExamples(true)
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .insert(EXAMPLE_PLANS)

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "6 planos de exemplo criados com sucesso!"
      })

      loadPlans()
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setCreatingExamples(false)
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

  const formatNumber = (value: number) => {
    if (value >= 999999) return '∞'
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  const getPricePerPlate = (price: number, maxVehicles: number) => {
    if (maxVehicles >= 999999) return null
    return (price / maxVehicles).toFixed(2)
  }

  const getPlanTier = (planName: string) => {
    return PLAN_TIERS[planName as keyof typeof PLAN_TIERS] || { 
      color: 'bg-muted text-muted-foreground border-border', 
      icon: Car 
    }
  }

  const hasWhatsAppReports = (features: string[]) => {
    return features.some(f => f.includes('Relatórios WhatsApp para Gestor'))
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
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Gestão de Planos de Assinatura
              </CardTitle>
              <CardDescription>
                Planos baseados em quantidade de placas cadastradas
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {plans.length === 0 && (
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={createExamplePlans}
                  disabled={creatingExamples}
                >
                  {creatingExamples ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Criar Planos de Exemplo
                </Button>
              )}
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
                    {/* Campo principal: Limite de Placas */}
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                      <Label htmlFor="max_vehicles" className="text-base font-semibold flex items-center gap-2">
                        <Car className="w-5 h-5 text-primary" />
                        Limite de Placas Cadastradas *
                      </Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        Define quantas placas/veículos a empresa pode cadastrar
                      </p>
                      <Input
                        id="max_vehicles"
                        type="number"
                        value={formData.max_vehicles}
                        onChange={(e) => setFormData(prev => ({ ...prev, max_vehicles: parseInt(e.target.value) || 0 }))}
                        className="text-lg font-bold"
                        placeholder="100"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Use 999999 para ilimitado
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Nome do Plano *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Profissional"
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
                        rows={2}
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
                        {formData.price_monthly > 0 && formData.max_vehicles > 0 && formData.max_vehicles < 999999 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ≈ R$ {getPricePerPlate(formData.price_monthly, formData.max_vehicles)}/placa
                          </p>
                        )}
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
                        {formData.price_yearly > 0 && formData.price_monthly > 0 && (
                          <p className="text-xs text-emerald-500 mt-1">
                            {Math.round((1 - (formData.price_yearly / (formData.price_monthly * 12))) * 100)}% de desconto
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="max_users">Máximo de Usuários</Label>
                        <Input
                          id="max_users"
                          type="number"
                          value={formData.max_users}
                          onChange={(e) => setFormData(prev => ({ ...prev, max_users: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="max_messages_per_month">Mensagens/Mês</Label>
                        <Input
                          id="max_messages_per_month"
                          type="number"
                          value={formData.max_messages_per_month}
                          onChange={(e) => setFormData(prev => ({ ...prev, max_messages_per_month: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                      <p className="text-xs text-muted-foreground mb-1">
                        Use "📊 Relatórios WhatsApp para Gestor" apenas para planos Profissional ou superior
                      </p>
                      <Textarea
                        id="features"
                        value={featuresText}
                        onChange={(e) => setFeaturesText(e.target.value)}
                        placeholder="Dashboard completo&#10;Relatórios avançados&#10;📊 Relatórios WhatsApp para Gestor&#10;Suporte prioritário"
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
          </div>
        </CardHeader>
      </Card>

      {/* Legenda de Recursos Exclusivos */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-violet-500/10 text-violet-500 border-violet-500/30">
            <MessageSquare className="w-3 h-3 mr-1" />
            PRO+
          </Badge>
          <span className="text-muted-foreground">Relatórios WhatsApp para Gestor (Profissional ou superior)</span>
        </div>
      </div>

      {/* Cards dos Planos */}
      {plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum plano cadastrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie planos de assinatura baseados em quantidade de placas
            </p>
            <Button onClick={createExamplePlans} disabled={creatingExamples}>
              {creatingExamples ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Criar 6 Planos de Exemplo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const tier = getPlanTier(plan.name)
            const TierIcon = tier.icon
            const pricePerPlate = getPricePerPlate(plan.price_monthly, plan.max_vehicles)
            const isPopular = (tier as any).popular
            const hasReports = hasWhatsAppReports(plan.features)

            return (
              <Card 
                key={plan.id} 
                className={`relative overflow-hidden transition-all ${!plan.is_active ? 'opacity-60' : ''} ${isPopular ? 'ring-2 ring-primary' : ''}`}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg font-medium">
                    ⭐ Mais Popular
                  </div>
                )}
                
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge className={`${tier.color} border`}>
                      <TierIcon className="w-3 h-3 mr-1" />
                      {plan.name}
                    </Badge>
                    <Switch
                      checked={plan.is_active}
                      onCheckedChange={(checked) => togglePlanStatus(plan.id, checked)}
                    />
                  </div>
                  <CardDescription className="mt-2">{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Destaque: Limite de Placas */}
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Car className="w-5 h-5 text-primary" />
                      <span className="text-2xl font-bold">
                        {formatNumber(plan.max_vehicles)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {plan.max_vehicles >= 999999 ? 'placas ilimitadas' : 'placas cadastradas'}
                    </p>
                  </div>

                  {/* Preços */}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 bg-background rounded border">
                      <div className="text-lg font-bold text-primary">
                        {formatCurrency(plan.price_monthly)}
                      </div>
                      <div className="text-xs text-muted-foreground">/mês</div>
                      {pricePerPlate && (
                        <div className="text-xs text-muted-foreground mt-1">
                          R$ {pricePerPlate}/placa
                        </div>
                      )}
                    </div>
                    <div className="p-2 bg-background rounded border">
                      <div className="text-lg font-bold">
                        {formatCurrency(plan.price_yearly)}
                      </div>
                      <div className="text-xs text-muted-foreground">/ano</div>
                      {plan.price_monthly > 0 && (
                        <Badge variant="secondary" className="text-xs mt-1 bg-emerald-500/10 text-emerald-500">
                          {Math.round((1 - (plan.price_yearly / (plan.price_monthly * 12))) * 100)}% off
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Limites */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>{formatNumber(plan.max_users)} usuários</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-muted-foreground" />
                      <span>{formatNumber(plan.max_messages_per_month)} msgs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-muted-foreground" />
                      <span>{formatNumber(plan.max_storage_mb)} MB</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      <span>{formatNumber(plan.max_api_calls_per_day)} API/dia</span>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-1">
                    {plan.features.slice(0, 5).map((feature, index) => {
                      const isWhatsAppReport = feature.includes('Relatórios WhatsApp para Gestor')
                      return (
                        <div 
                          key={index} 
                          className={`flex items-start gap-2 text-sm ${isWhatsAppReport ? 'text-violet-500 font-medium' : ''}`}
                        >
                          {isWhatsAppReport ? (
                            <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          ) : (
                            <Check className="w-4 h-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                          )}
                          <span>{feature.replace('📊 ', '')}</span>
                          {isWhatsAppReport && (
                            <Badge variant="outline" className="text-xs bg-violet-500/10 text-violet-500 border-violet-500/30 ml-auto">
                              PRO+
                            </Badge>
                          )}
                        </div>
                      )
                    })}
                    {plan.features.length > 5 && (
                      <div className="text-xs text-muted-foreground pl-6">
                        +{plan.features.length - 5} mais funcionalidades
                      </div>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="flex gap-2 pt-0">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleEdit(plan)}
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => deletePlan(plan.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
