import { useState, useEffect } from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Plus, Edit2, Trash2, Copy, Check, QrCode, UserPlus, Link2, Users } from "lucide-react"
import QRCode from "qrcode"

interface Seller {
  id: string
  name: string
  code: string
  phone: string | null
  email: string | null
  commission_rate: number
  is_active: boolean
  registrations_count: number
  created_at: string
}

export default function SellersPage() {
  const { toast } = useToast()
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [companySlug, setCompanySlug] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null)
  const [sellerToDelete, setSellerToDelete] = useState<Seller | null>(null)
  const [qrCodeDialogOpen, setQrCodeDialogOpen] = useState(false)
  const [selectedSellerForQR, setSelectedSellerForQR] = useState<Seller | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    phone: "",
    email: "",
    commission_rate: 0,
    is_active: true,
  })

  useEffect(() => {
    loadSellers()
  }, [])

  const loadSellers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile) return

      // Buscar slug da empresa
      const { data: company } = await supabase
        .from('companies')
        .select('slug')
        .eq('id', profile.company_id)
        .single()

      if (company?.slug) {
        setCompanySlug(company.slug)
      }

      const { data, error } = await supabase
        .from('sellers')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name')

      if (error) throw error
      setSellers(data || [])
    } catch (error) {
      console.error('Error loading sellers:', error)
      toast({
        title: "Erro ao carregar vendedores",
        description: "Tente novamente",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const generateCode = (name: string) => {
    const normalized = name
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6)
    
    const suffix = Math.floor(Math.random() * 100).toString().padStart(2, '0')
    return `${normalized}${suffix}`
  }

  const openNewSellerDialog = () => {
    setEditingSeller(null)
    setFormData({
      name: "",
      code: "",
      phone: "",
      email: "",
      commission_rate: 0,
      is_active: true,
    })
    setDialogOpen(true)
  }

  const openEditDialog = (seller: Seller) => {
    setEditingSeller(seller)
    setFormData({
      name: seller.name,
      code: seller.code,
      phone: seller.phone || "",
      email: seller.email || "",
      commission_rate: seller.commission_rate,
      is_active: seller.is_active,
    })
    setDialogOpen(true)
  }

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      // Auto-gerar código se estiver criando novo vendedor
      code: !editingSeller && name.length >= 3 ? generateCode(name) : prev.code
    }))
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      toast({
        title: "Dados inválidos",
        description: "Nome e código são obrigatórios",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile) return

      const sellerData = {
        company_id: profile.company_id,
        name: formData.name.toUpperCase(),
        code: formData.code.toUpperCase(),
        phone: formData.phone || null,
        email: formData.email || null,
        commission_rate: formData.commission_rate,
        is_active: formData.is_active,
      }

      if (editingSeller) {
        const { error } = await supabase
          .from('sellers')
          .update(sellerData)
          .eq('id', editingSeller.id)

        if (error) throw error
        toast({ title: "Vendedor atualizado com sucesso!" })
      } else {
        const { error } = await supabase
          .from('sellers')
          .insert(sellerData)

        if (error) {
          if (error.code === '23505') {
            toast({
              title: "Código já existe",
              description: "Escolha outro código para o vendedor",
              variant: "destructive"
            })
            return
          }
          throw error
        }
        toast({ title: "Vendedor cadastrado com sucesso!" })
      }

      setDialogOpen(false)
      loadSellers()
    } catch (error) {
      console.error('Error saving seller:', error)
      toast({
        title: "Erro ao salvar vendedor",
        description: "Tente novamente",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!sellerToDelete) return

    try {
      const { error } = await supabase
        .from('sellers')
        .delete()
        .eq('id', sellerToDelete.id)

      if (error) throw error

      toast({ title: "Vendedor excluído com sucesso!" })
      setDeleteDialogOpen(false)
      setSellerToDelete(null)
      loadSellers()
    } catch (error) {
      console.error('Error deleting seller:', error)
      toast({
        title: "Erro ao excluir vendedor",
        description: "Tente novamente",
        variant: "destructive"
      })
    }
  }

  const getSellerLink = (seller: Seller) => {
    return `${window.location.origin}/cadastro/${companySlug}?ref=${seller.code}`
  }

  const copyLink = async (seller: Seller) => {
    try {
      await navigator.clipboard.writeText(getSellerLink(seller))
      setCopiedId(seller.id)
      toast({ title: "Link copiado!" })
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Tente novamente",
        variant: "destructive"
      })
    }
  }

  const showQRCode = async (seller: Seller) => {
    try {
      const qrCode = await QRCode.toDataURL(getSellerLink(seller), {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      })
      setQrCodeUrl(qrCode)
      setSelectedSellerForQR(seller)
      setQrCodeDialogOpen(true)
    } catch (error) {
      console.error('Error generating QR code:', error)
    }
  }

  const downloadQRCode = () => {
    if (!selectedSellerForQR) return
    const link = document.createElement('a')
    link.href = qrCodeUrl
    link.download = `qrcode-${selectedSellerForQR.code}.png`
    link.click()
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Vendedores</h1>
            <p className="text-muted-foreground">
              Gerencie vendedores e seus links de indicação
            </p>
          </div>
          <Button onClick={openNewSellerDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Vendedor
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{sellers.length}</p>
                  <p className="text-sm text-muted-foreground">Total de Vendedores</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <UserPlus className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {sellers.reduce((acc, s) => acc + s.registrations_count, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Cadastros Indicados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-500/10">
                  <Link2 className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{sellers.filter(s => s.is_active).length}</p>
                  <p className="text-sm text-muted-foreground">Vendedores Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de vendedores */}
        {sellers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum vendedor cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Cadastre vendedores para rastrear indicações de clientes
              </p>
              <Button onClick={openNewSellerDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeiro Vendedor
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sellers.map((seller) => (
              <Card key={seller.id} className={!seller.is_active ? "opacity-60" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{seller.name}</CardTitle>
                      <CardDescription className="font-mono">
                        Código: {seller.code}
                      </CardDescription>
                    </div>
                    <Badge variant={seller.is_active ? "default" : "secondary"}>
                      {seller.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                      <span>{seller.registrations_count} cadastro(s)</span>
                    </div>
                    {seller.commission_rate > 0 && (
                      <div className="text-muted-foreground">
                        {seller.commission_rate}% comissão
                      </div>
                    )}
                  </div>

                  {seller.phone && (
                    <p className="text-sm text-muted-foreground">📞 {seller.phone}</p>
                  )}
                  {seller.email && (
                    <p className="text-sm text-muted-foreground">✉️ {seller.email}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(seller)}
                    >
                      {copiedId === seller.id ? (
                        <Check className="h-4 w-4 mr-1" />
                      ) : (
                        <Copy className="h-4 w-4 mr-1" />
                      )}
                      Copiar Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => showQRCode(seller)}
                    >
                      <QrCode className="h-4 w-4 mr-1" />
                      QR Code
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(seller)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSellerToDelete(seller)
                        setDeleteDialogOpen(true)
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog de criar/editar vendedor */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSeller ? "Editar Vendedor" : "Novo Vendedor"}
            </DialogTitle>
            <DialogDescription>
              {editingSeller 
                ? "Atualize os dados do vendedor"
                : "Cadastre um novo vendedor para rastrear indicações"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Nome do vendedor"
              />
            </div>

            <div>
              <Label>Código *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="VENDEDOR01"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Código único usado no link de indicação
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Telefone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div>
              <Label>Comissão (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={formData.commission_rate}
                onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Vendedor Ativo</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Vendedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O vendedor <strong>{sellerToDelete?.name}</strong> será 
              permanentemente excluído, mas os cadastros já vinculados a ele serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de QR Code */}
      <Dialog open={qrCodeDialogOpen} onOpenChange={setQrCodeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code - {selectedSellerForQR?.name}</DialogTitle>
            <DialogDescription>
              Código: {selectedSellerForQR?.code}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            {qrCodeUrl && (
              <img 
                src={qrCodeUrl} 
                alt="QR Code do vendedor" 
                className="border rounded-lg"
              />
            )}
            <p className="text-xs text-muted-foreground text-center break-all">
              {selectedSellerForQR && getSellerLink(selectedSellerForQR)}
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => selectedSellerForQR && copyLink(selectedSellerForQR)}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar Link
            </Button>
            <Button onClick={downloadQRCode}>
              Baixar QR Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
