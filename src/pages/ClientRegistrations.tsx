import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, XCircle, Clock, Eye, Trash2, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface Registration {
  id: string
  name: string
  email: string
  phone: string
  document: string
  birth_date: string
  status: string
  created_at: string
  vehicle_plate: string
  vehicle_brand: string
  vehicle_model: string
  vehicle_year: number
  vehicle_color: string
  rejection_reason?: string
  // Campos de endereço
  cep?: string
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  // Contato de emergência
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relationship?: string
  // Veículo
  has_gnv?: boolean
  is_armored?: boolean
}

export default function ClientRegistrations() {
  const { toast } = useToast()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [processing, setProcessing] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [registrationToDelete, setRegistrationToDelete] = useState<Registration | null>(null)

  useEffect(() => {
    loadRegistrations()
  }, [])

  const loadRegistrations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile) return

      const { data, error } = await supabase
        .from('client_registrations')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRegistrations(data || [])
    } catch (error) {
      console.error('Error loading registrations:', error)
      toast({
        title: "Erro ao carregar cadastros",
        description: "Tente novamente",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (registration: Registration) => {
    setProcessing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setProcessing(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile) {
        setProcessing(false)
        return
      }

      // 1. Verificar se já existe cliente com o mesmo documento
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id, name')
        .eq('company_id', profile.company_id)
        .eq('document', registration.document)
        .maybeSingle()

      let clientId: string

      if (existingClient) {
        // Atualizar cliente existente com todos os dados
        const { error: updateClientError } = await supabase
          .from('clients')
          .update({
            name: registration.name,
            email: registration.email,
            phone: registration.phone,
            birth_date: registration.birth_date,
            cep: registration.cep,
            street: registration.street,
            number: registration.number,
            complement: registration.complement,
            neighborhood: registration.neighborhood,
            city: registration.city,
            state: registration.state,
            emergency_contact_name: registration.emergency_contact_name,
            emergency_contact_phone: registration.emergency_contact_phone,
            emergency_contact_relationship: registration.emergency_contact_relationship,
            address: `${registration.street}, ${registration.number}${registration.complement ? `, ${registration.complement}` : ''} - ${registration.neighborhood}, ${registration.city}-${registration.state}, CEP: ${registration.cep}`,
            status: 'active'
          })
          .eq('id', existingClient.id)

        if (updateClientError) {
          console.error('Error updating client:', updateClientError)
          throw new Error('Erro ao atualizar dados do cliente')
        }
        clientId = existingClient.id
        console.log('Cliente existente atualizado:', existingClient.name)
      } else {
        // Criar novo cliente com todos os dados
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            company_id: profile.company_id,
            name: registration.name,
            email: registration.email,
            phone: registration.phone,
            document: registration.document,
            birth_date: registration.birth_date,
            cep: registration.cep,
            street: registration.street,
            number: registration.number,
            complement: registration.complement,
            neighborhood: registration.neighborhood,
            city: registration.city,
            state: registration.state,
            emergency_contact_name: registration.emergency_contact_name,
            emergency_contact_phone: registration.emergency_contact_phone,
            emergency_contact_relationship: registration.emergency_contact_relationship,
            address: `${registration.street}, ${registration.number}${registration.complement ? `, ${registration.complement}` : ''} - ${registration.neighborhood}, ${registration.city}-${registration.state}, CEP: ${registration.cep}`,
            status: 'active'
          })
          .select()
          .single()

        if (clientError) {
          console.error('Error creating client:', clientError)
          throw new Error('Erro ao criar cliente')
        }
        clientId = newClient.id
        console.log('Novo cliente criado:', newClient.name)
      }

      // 2. Verificar se já existe veículo com a mesma placa
      const { data: existingVehicle } = await supabase
        .from('vehicles')
        .select('id, client_id, license_plate')
        .eq('company_id', profile.company_id)
        .eq('license_plate', registration.vehicle_plate)
        .maybeSingle()

      let vehicleId: string

      if (existingVehicle) {
        // Se o veículo pertence a outro cliente, mostrar erro
        if (existingVehicle.client_id !== clientId) {
          const { data: otherClient } = await supabase
            .from('clients')
            .select('name')
            .eq('id', existingVehicle.client_id)
            .maybeSingle()

          throw new Error(
            `O veículo com placa ${registration.vehicle_plate} já está cadastrado para outro cliente${otherClient ? ` (${otherClient.name})` : ''}. ` +
            `Verifique se a placa está correta ou transfira o veículo primeiro.`
          )
        }
        // Usar veículo existente do mesmo cliente
        vehicleId = existingVehicle.id
        console.log('Veículo existente reutilizado:', existingVehicle.license_plate)
      } else {
        // Criar novo veículo com todos os dados
        const { data: newVehicle, error: vehicleError } = await supabase
          .from('vehicles')
          .insert({
            company_id: profile.company_id,
            client_id: clientId,
            license_plate: registration.vehicle_plate,
            brand: registration.vehicle_brand,
            model: registration.vehicle_model,
            year: registration.vehicle_year || new Date().getFullYear(),
            color: registration.vehicle_color || 'Não especificada',
            has_gnv: registration.has_gnv || false,
            is_armored: registration.is_armored || false,
            tracker_status: 'pending',
            is_active: true
          })
          .select()
          .single()

        if (vehicleError) {
          console.error('Error creating vehicle:', vehicleError)
          throw new Error('Erro ao criar veículo')
        }
        vehicleId = newVehicle.id
        console.log('Novo veículo criado:', newVehicle.license_plate)
      }

      // 3. Atualizar status do registro
      const { error: updateError } = await supabase
        .from('client_registrations')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          client_id: clientId,
          vehicle_id: vehicleId
        })
        .eq('id', registration.id)

      if (updateError) {
        console.error('Error updating registration:', updateError)
        throw new Error('Erro ao atualizar registro')
      }

      // Enviar notificação WhatsApp ao cliente
      const approvalMessage = `✅ *Cadastro Aprovado!*\n\n` +
        `Olá ${registration.name}!\n\n` +
        `Seu cadastro foi aprovado com sucesso! ` +
        `Bem-vindo(a) ao nosso sistema.\n\n` +
        `Dados aprovados:\n` +
        `• Veículo: ${registration.vehicle_brand} ${registration.vehicle_model}\n` +
        `• Placa: ${registration.vehicle_plate}\n\n` +
        `Em breve entraremos em contato para os próximos passos.`

      // Enviar notificação (não aguardar para não travar a UI)
      supabase.functions.invoke('notify-whatsapp', {
        body: {
          client_id: clientId,
          message: approvalMessage
        }
      }).catch(err => {
        console.error('Failed to send WhatsApp notification:', err)
      })

      toast({
        title: "Cadastro aprovado!",
        description: existingClient 
          ? "Cliente atualizado e veículo vinculado com sucesso." 
          : "Cliente e veículo criados com sucesso."
      })

      setDetailsOpen(false)
      loadRegistrations()
    } catch (error: any) {
      console.error('Error approving registration:', error)
      toast({
        title: "Erro ao aprovar cadastro",
        description: error.message || "Tente novamente",
        variant: "destructive"
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedRegistration || !rejectReason.trim()) {
      toast({
        title: "Motivo obrigatório",
        description: "Informe o motivo da rejeição",
        variant: "destructive"
      })
      return
    }

    setProcessing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (!profile) return

      const { error } = await supabase
        .from('client_registrations')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectReason
        })
        .eq('id', selectedRegistration.id)

      if (error) throw error

      // Buscar o cliente pelo telefone para enviar notificação
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('phone', selectedRegistration.phone)
        .eq('company_id', profile.company_id)
        .maybeSingle()

      // Enviar notificação WhatsApp ao cliente
      const rejectionMessage = `❌ *Cadastro Não Aprovado*\n\n` +
        `Olá ${selectedRegistration.name},\n\n` +
        `Infelizmente seu cadastro não foi aprovado.\n\n` +
        `Motivo: ${rejectReason}\n\n` +
        `Entre em contato conosco para mais informações.`

      // Se o cliente já existe no sistema, enviar notificação
      if (existingClient) {
        supabase.functions.invoke('notify-whatsapp', {
          body: {
            client_id: existingClient.id,
            message: rejectionMessage
          }
        }).catch(err => {
          console.error('Failed to send WhatsApp notification:', err)
        })
      } else {
        // Se não existe, criar temporariamente para enviar a notificação
        const { data: tempClient } = await supabase
          .from('clients')
          .insert({
            company_id: profile.company_id,
            name: selectedRegistration.name,
            phone: selectedRegistration.phone,
            document: selectedRegistration.document,
            status: 'inactive'
          })
          .select('id')
          .single()

        if (tempClient) {
          supabase.functions.invoke('notify-whatsapp', {
            body: {
              client_id: tempClient.id,
              message: rejectionMessage
            }
          }).catch(err => {
            console.error('Failed to send WhatsApp notification:', err)
          })
        }
      }

      toast({
        title: "Cadastro rejeitado",
        description: "O cliente será notificado."
      })

      setDetailsOpen(false)
      setRejectReason("")
      loadRegistrations()
    } catch (error) {
      console.error('Error rejecting registration:', error)
      toast({
        title: "Erro ao rejeitar cadastro",
        description: "Tente novamente",
        variant: "destructive"
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async () => {
    if (!registrationToDelete) return

    setProcessing(true)
    try {
      const { error } = await supabase
        .from('client_registrations')
        .delete()
        .eq('id', registrationToDelete.id)

      if (error) throw error

      toast({
        title: "Cadastro excluído",
        description: "O cadastro foi removido permanentemente."
      })

      setDeleteDialogOpen(false)
      setRegistrationToDelete(null)
      if (detailsOpen) setDetailsOpen(false)
      loadRegistrations()
    } catch (error) {
      console.error('Error deleting registration:', error)
      toast({
        title: "Erro ao excluir cadastro",
        description: "Tente novamente",
        variant: "destructive"
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleReevaluate = async (registration: Registration) => {
    setProcessing(true)
    try {
      const { error } = await supabase
        .from('client_registrations')
        .update({
          status: 'pending',
          reviewed_by: null,
          reviewed_at: null,
          rejection_reason: null
        })
        .eq('id', registration.id)

      if (error) throw error

      toast({
        title: "Cadastro reenviado para avaliação",
        description: "O status foi alterado para pendente."
      })

      if (detailsOpen) setDetailsOpen(false)
      loadRegistrations()
    } catch (error) {
      console.error('Error re-evaluating registration:', error)
      toast({
        title: "Erro ao reavaliar cadastro",
        description: "Tente novamente",
        variant: "destructive"
      })
    } finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Aprovado</Badge>
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Rejeitado</Badge>
      default:
        return null
    }
  }

  const filteredRegistrations = (status: string) => {
    return registrations.filter(r => r.status === status)
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
        <div>
          <h1 className="text-3xl font-bold">Cadastros de Clientes</h1>
          <p className="text-muted-foreground">
            Gerencie os cadastros enviados pelos clientes
          </p>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList>
            <TabsTrigger value="pending">
              Pendentes ({filteredRegistrations('pending').length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Aprovados ({filteredRegistrations('approved').length})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejeitados ({filteredRegistrations('rejected').length})
            </TabsTrigger>
          </TabsList>

          {['pending', 'approved', 'rejected'].map((status) => (
            <TabsContent key={status} value={status} className="space-y-4">
              {filteredRegistrations(status).length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Nenhum cadastro {status === 'pending' ? 'pendente' : status === 'approved' ? 'aprovado' : 'rejeitado'}
                  </CardContent>
                </Card>
              ) : (
                filteredRegistrations(status).map((registration) => (
                  <Card key={registration.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{registration.name}</CardTitle>
                          <CardDescription>
                            {registration.vehicle_brand} {registration.vehicle_model} - {registration.vehicle_plate}
                          </CardDescription>
                        </div>
                        {getStatusBadge(registration.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium">Telefone:</span> {registration.phone}</p>
                        <p><span className="font-medium">CPF:</span> {registration.document}</p>
                        <p><span className="font-medium">Data de cadastro:</span> {format(new Date(registration.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                        {registration.rejection_reason && (
                          <p className="text-destructive">
                            <span className="font-medium">Motivo da rejeição:</span> {registration.rejection_reason}
                          </p>
                        )}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRegistration(registration)
                            setDetailsOpen(true)
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalhes
                        </Button>
                        {registration.status === 'rejected' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReevaluate(registration)}
                            disabled={processing}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Reavaliar
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setRegistrationToDelete(registration)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Modal de Detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Cadastro</DialogTitle>
            <DialogDescription>
              Revise todas as informações antes de aprovar ou rejeitar
            </DialogDescription>
          </DialogHeader>

          {selectedRegistration && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Dados Pessoais</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nome</p>
                    <p className="font-medium">{selectedRegistration.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data de Nascimento</p>
                    <p className="font-medium">{format(new Date(selectedRegistration.birth_date), "dd/MM/yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">CPF</p>
                    <p className="font-medium">{selectedRegistration.document}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Telefone</p>
                    <p className="font-medium">{selectedRegistration.phone}</p>
                  </div>
                  {selectedRegistration.email && (
                    <div>
                      <p className="text-muted-foreground">E-mail</p>
                      <p className="font-medium">{selectedRegistration.email}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Dados do Veículo</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Placa</p>
                    <p className="font-medium">{selectedRegistration.vehicle_plate}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Marca/Modelo</p>
                    <p className="font-medium">{selectedRegistration.vehicle_brand} {selectedRegistration.vehicle_model}</p>
                  </div>
                </div>
              </div>

              {selectedRegistration.status === 'pending' && (
                <div className="space-y-4">
                  <div>
                    <Label>Motivo da Rejeição (opcional)</Label>
                    <Textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Informe o motivo caso vá rejeitar..."
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setRegistrationToDelete(selectedRegistration)
                  setDeleteDialogOpen(true)
                }}
                disabled={processing}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </div>
            <div className="flex gap-2 ml-auto">
              {selectedRegistration?.status === 'pending' && (
                <>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={processing}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Rejeitar
                  </Button>
                  <Button
                    onClick={() => selectedRegistration && handleApprove(selectedRegistration)}
                    disabled={processing}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Aprovar
                  </Button>
                </>
              )}
              {selectedRegistration?.status === 'rejected' && (
                <Button
                  onClick={() => selectedRegistration && handleReevaluate(selectedRegistration)}
                  disabled={processing}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Voltar para Avaliação
                </Button>
              )}
              <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                Fechar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cadastro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cadastro de <strong>{registrationToDelete?.name}</strong> será permanentemente excluído do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={processing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}