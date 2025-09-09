import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Users, Plus, Key, Trash2, UserPlus, RefreshCw } from "lucide-react"

interface CompanyUsersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string | null
  companyName: string
}

interface User {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
}

export function CompanyUsersDialog({
  open,
  onOpenChange,
  companyId,
  companyName
}: CompanyUsersDialogProps) {
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showPasswordReset, setShowPasswordReset] = useState<string | null>(null)
  
  // Create user form
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'admin'
  })
  
  // Password reset form
  const [newPassword, setNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const loadUsers = async () => {
    if (!companyId) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
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

  const createUser = async () => {
    if (!companyId || !newUser.email || !newUser.password || !newUser.full_name) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Não autenticado')

      const response = await supabase.functions.invoke('admin-user-management', {
        body: {
          action: 'create_user',
          email: newUser.email,
          password: newUser.password,
          full_name: newUser.full_name,
          company_id: companyId,
          role: newUser.role
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (response.error) throw response.error

      toast({
        title: "Sucesso",
        description: "Usuário criado com sucesso! Ele pode fazer login imediatamente."
      })

      setNewUser({ email: '', password: '', full_name: '', role: 'admin' })
      setShowCreateForm(false)
      await loadUsers()
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

  const resetPassword = async (userId: string) => {
    if (!newPassword) {
      toast({
        title: "Erro",
        description: "Digite a nova senha",
        variant: "destructive"
      })
      return
    }

    setResetLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Não autenticado')

      const response = await supabase.functions.invoke('admin-user-management', {
        body: {
          action: 'reset_password',
          user_id: userId,
          new_password: newPassword
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (response.error) throw response.error

      toast({
        title: "Sucesso",
        description: "Senha resetada com sucesso! O usuário já pode usar a nova senha."
      })

      setNewPassword('')
      setShowPasswordReset(null)
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setResetLoading(false)
    }
  }

  const deleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário "${userEmail}"? Esta ação não pode ser desfeita.`)) {
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Não autenticado')

      const response = await supabase.functions.invoke('admin-user-management', {
        body: {
          action: 'delete_user',
          user_id: userId
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (response.error) throw response.error

      toast({
        title: "Sucesso",
        description: "Usuário excluído com sucesso"
      })

      await loadUsers()
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    if (open && companyId) {
      loadUsers()
    }
  }, [open, companyId])

  if (!companyId) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Usuários - {companyName}
          </DialogTitle>
          <DialogDescription>
            Gerencie os usuários da empresa com acesso imediato
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Create User Form */}
          {showCreateForm && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Criar Novo Usuário
                </CardTitle>
                <CardDescription>
                  O usuário poderá fazer login imediatamente, sem confirmação por e-mail
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="usuario@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Senha forte"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nome Completo *</Label>
                    <Input
                      id="full_name"
                      value={newUser.full_name}
                      onChange={(e) => setNewUser(prev => ({ ...prev, full_name: e.target.value }))}
                      placeholder="Nome completo do usuário"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Função</Label>
                    <Select value={newUser.role} onValueChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="user">Usuário</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={createUser} disabled={loading} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Criar Usuário
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCreateForm(false)}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Password Reset Form */}
          {showPasswordReset && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Resetar Senha
                </CardTitle>
                <CardDescription>
                  A nova senha terá efeito imediatamente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new_password">Nova Senha</Label>
                  <Input
                    id="new_password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => resetPassword(showPasswordReset)} 
                    disabled={resetLoading}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Resetar Senha
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowPasswordReset(null)
                      setNewPassword('')
                    }}
                    disabled={resetLoading}
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Users Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Usuários Cadastrados</CardTitle>
                <Button 
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center gap-2"
                  disabled={showCreateForm}
                >
                  <Plus className="w-4 h-4" />
                  Novo Usuário
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                              {user.role === 'admin' ? 'Administrador' : 'Usuário'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.is_active ? 'default' : 'destructive'}>
                              {user.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(user.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowPasswordReset(user.id)}
                                className="flex items-center gap-2"
                                disabled={showPasswordReset === user.id}
                              >
                                <Key className="w-3 h-3" />
                                Resetar Senha
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteUser(user.id, user.email)}
                                className="flex items-center gap-2 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-3 h-3" />
                                Excluir
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {users.length === 0 && (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-muted-foreground">
                        Nenhum usuário encontrado
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Crie o primeiro usuário para esta empresa
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}