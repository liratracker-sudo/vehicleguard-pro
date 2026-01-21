import { useState } from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  DollarSign, 
  CheckCircle, 
  Calendar,
  Car,
  Loader2,
  AlertTriangle,
  Power
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Switch } from "@/components/ui/switch"
import { usePlans, Plan } from "@/hooks/usePlans"
import { useToast } from "@/hooks/use-toast"

const PlansPage = () => {
  const { plans, loading, contractCounts, createPlan, updatePlan, deletePlan, deactivatePlan } = usePlans()
  const { toast } = useToast()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    billing_cycle: "monthly",
    features: "",
    is_active: true
  })

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      billing_cycle: "monthly",
      features: "",
      is_active: true
    })
    setEditingPlan(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCreatePlan = async () => {
    if (!formData.name || !formData.price) {
      toast({
        title: "Erro",
        description: "Nome e preço são obrigatórios",
        variant: "destructive"
      })
      return
    }

    try {
      setIsSubmitting(true)
      const featuresArray = formData.features
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.length > 0)

      await createPlan({
        name: formData.name,
        description: formData.description || undefined,
        price: parseFloat(formData.price),
        billing_cycle: formData.billing_cycle,
        features: featuresArray,
        is_active: formData.is_active
      })

      resetForm()
      setIsCreateDialogOpen(false)
    } catch (error) {
      // Error already handled by the hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan)
    setFormData({
      name: plan.name,
      description: plan.description || "",
      price: plan.price.toString(),
      billing_cycle: plan.billing_cycle,
      features: Array.isArray(plan.features) ? plan.features.join('\n') : '',
      is_active: plan.is_active
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdatePlan = async () => {
    if (!editingPlan) return
    
    if (!formData.name || !formData.price) {
      toast({
        title: "Erro",
        description: "Nome e preço são obrigatórios",
        variant: "destructive"
      })
      return
    }

    try {
      setIsSubmitting(true)
      const featuresArray = formData.features
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.length > 0)

      await updatePlan(editingPlan.id, {
        name: formData.name,
        description: formData.description || undefined,
        price: parseFloat(formData.price),
        billing_cycle: formData.billing_cycle,
        features: featuresArray,
        is_active: formData.is_active
      })

      resetForm()
      setIsEditDialogOpen(false)
    } catch (error) {
      // Error already handled by the hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePlan = async (planId: string) => {
    try {
      await deletePlan(planId)
    } catch (error) {
      // Error already handled by the hook
    }
  }

  const handleDeactivatePlan = async (planId: string) => {
    try {
      await deactivatePlan(planId)
    } catch (error) {
      // Error already handled by the hook
    }
  }

  const getBillingCycleBadge = (cycle: string) => {
    switch (cycle) {
      case 'monthly':
        return <Badge variant="outline">Mensal</Badge>
      case 'quarterly':
        return <Badge variant="outline">Trimestral</Badge>
      case 'yearly':
        return <Badge variant="outline">Anual</Badge>
      default:
        return <Badge variant="outline">Mensal</Badge>
    }
  }

  const activePlans = plans.filter(plan => plan.is_active)
  const totalContracts = Object.values(contractCounts).reduce((sum, count) => sum + count, 0)
  const totalRevenue = plans.reduce((sum, plan) => sum + (plan.price * (contractCounts[plan.id] || 0)), 0)

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Planos</h1>
            <p className="text-muted-foreground">
              Gerencie os planos de rastreamento da sua empresa
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Plano
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Criar Novo Plano</DialogTitle>
                <DialogDescription>
                  Configure um novo plano de rastreamento para seus clientes
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Nome *
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder="Ex: Premium"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="price" className="text-right">
                    Preço (R$) *
                  </Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="billing_cycle" className="text-right">
                    Ciclo
                  </Label>
                  <Select value={formData.billing_cycle} onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, billing_cycle: value }))
                  }>
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="quarterly">Trimestral</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="description" className="text-right mt-2">
                    Descrição
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder="Descrição do plano..."
                  />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="features" className="text-right mt-2">
                    Recursos
                  </Label>
                  <Textarea
                    id="features"
                    name="features"
                    value={formData.features}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder="Um recurso por linha..."
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="is_active" className="text-right">
                    Ativo
                  </Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, is_active: checked }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsCreateDialogOpen(false)
                    resetForm()
                  }}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreatePlan}
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Criar Plano
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Editar Plano</DialogTitle>
                <DialogDescription>
                  Edite as informações do plano "{editingPlan?.name}"
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-name" className="text-right">
                    Nome *
                  </Label>
                  <Input
                    id="edit-name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder="Ex: Premium"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-price" className="text-right">
                    Preço (R$) *
                  </Label>
                  <Input
                    id="edit-price"
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-billing_cycle" className="text-right">
                    Ciclo
                  </Label>
                  <Select value={formData.billing_cycle} onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, billing_cycle: value }))
                  }>
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="quarterly">Trimestral</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="edit-description" className="text-right mt-2">
                    Descrição
                  </Label>
                  <Textarea
                    id="edit-description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder="Descrição do plano..."
                  />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="edit-features" className="text-right mt-2">
                    Recursos
                  </Label>
                  <Textarea
                    id="edit-features"
                    name="features"
                    value={formData.features}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder="Um recurso por linha..."
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-is_active" className="text-right">
                    Ativo
                  </Label>
                  <Switch
                    id="edit-is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, is_active: checked }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsEditDialogOpen(false)
                    resetForm()
                  }}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleUpdatePlan}
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar Alterações
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Planos</CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{plans.length}</div>
              <p className="text-xs text-muted-foreground">
                {activePlans.length} ativos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Contratos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalContracts.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Distribuídos nos planos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Receita mensal recorrente
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Preço Médio</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {plans.length > 0 ? 
                  (plans.reduce((sum, plan) => sum + plan.price, 0) / plans.length).toFixed(2) : 
                  '0.00'
                }
              </div>
              <p className="text-xs text-muted-foreground">
                Por plano
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Plans Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : plans.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Car className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum plano cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Crie seu primeiro plano de rastreamento
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Plano
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const planContractCount = contractCounts[plan.id] || 0;
              const hasContracts = planContractCount > 0;
              
              return (
                <Card key={plan.id} className="relative">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-xl">{plan.name}</CardTitle>
                          {hasContracts && (
                            <Badge variant="secondary" className="text-xs">
                              <Users className="w-3 h-3 mr-1" />
                              {planContractCount}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="mt-1">
                          {plan.description}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {plan.is_active ? (
                          <Badge className="bg-success/20 text-success border-success/30">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline">Inativo</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">
                        R$ {plan.price.toFixed(2)}
                      </span>
                      {getBillingCycleBadge(plan.billing_cycle)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {Array.isArray(plan.features) && plan.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-success shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleEditPlan(plan)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className={hasContracts ? "text-warning" : "text-destructive"}>
                            {hasContracts ? <Power className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {hasContracts ? "Desativar plano" : "Excluir plano"}
                            </AlertDialogTitle>
                            <AlertDialogDescription asChild>
                              <div className="space-y-3">
                                {hasContracts ? (
                                  <>
                                    <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                                      <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                                      <div>
                                        <p className="font-medium text-warning">
                                          Este plano possui {planContractCount} contrato(s) vinculado(s)
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                          A exclusão não é permitida para preservar o histórico. Você pode <strong>desativar</strong> o plano para que ele não apareça em novas contratações.
                                        </p>
                                      </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      Planos desativados mantêm os contratos existentes funcionando normalmente.
                                    </p>
                                  </>
                                ) : (
                                  <p>
                                    Tem certeza que deseja excluir o plano "{plan.name}"? Esta ação não pode ser desfeita.
                                  </p>
                                )}
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            {hasContracts ? (
                              <AlertDialogAction
                                onClick={() => handleDeactivatePlan(plan.id)}
                                className="bg-warning text-warning-foreground hover:bg-warning/90"
                              >
                                <Power className="w-4 h-4 mr-2" />
                                Desativar Plano
                              </AlertDialogAction>
                            ) : (
                              <AlertDialogAction 
                                onClick={() => handleDeletePlan(plan.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            )}
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default PlansPage
