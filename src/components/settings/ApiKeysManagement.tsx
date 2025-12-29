import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useApiKeys } from '@/hooks/useApiKeys'
import { 
  Key, 
  Plus, 
  Copy, 
  Trash2, 
  Eye, 
  EyeOff, 
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
} from '@/components/ui/alert-dialog'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Link } from 'react-router-dom'

export function ApiKeysManagement() {
  const { apiKeys, usageLogs, loading, creating, createApiKey, toggleApiKey, deleteApiKey } = useApiKeys()
  const [newKeyName, setNewKeyName] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [showNewKey, setShowNewKey] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return

    const key = await createApiKey(newKeyName.trim())
    if (key) {
      setNewKey(key)
      setNewKeyName('')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setNewKey(null)
    setNewKeyName('')
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
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
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Gerencie as chaves de API para integração com plataformas de rastreamento
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/api-docs">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Documentação
                </Link>
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova API Key
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova API Key</DialogTitle>
                    <DialogDescription>
                      Crie uma nova chave de API para integração. A chave completa será exibida apenas uma vez.
                    </DialogDescription>
                  </DialogHeader>

                  {!newKey ? (
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="keyName">Nome da Chave</Label>
                        <Input
                          id="keyName"
                          placeholder="Ex: Integração Tracker XYZ"
                          value={newKeyName}
                          onChange={(e) => setNewKeyName(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 py-4">
                      <div className="p-4 bg-muted rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Sua API Key</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowNewKey(!showNewKey)}
                          >
                            {showNewKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            value={showNewKey ? newKey : '•'.repeat(40)}
                            readOnly
                            className="font-mono text-sm"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(newKey)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-destructive font-medium">
                          ⚠️ Copie esta chave agora! Ela não será exibida novamente.
                        </p>
                      </div>
                    </div>
                  )}

                  <DialogFooter>
                    {!newKey ? (
                      <>
                        <Button variant="outline" onClick={handleCloseDialog}>
                          Cancelar
                        </Button>
                        <Button onClick={handleCreateKey} disabled={creating || !newKeyName.trim()}>
                          {creating ? 'Criando...' : 'Criar API Key'}
                        </Button>
                      </>
                    ) : (
                      <Button onClick={handleCloseDialog}>
                        Concluir
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma API Key criada</p>
              <p className="text-sm">Crie uma chave para começar a integração</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{key.name}</span>
                      <Badge variant={key.is_active ? 'default' : 'secondary'}>
                        {key.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {key.api_key_prefix}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Criada: {format(new Date(key.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      {key.last_used_at && (
                        <span>
                          Último uso: {format(new Date(key.last_used_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={key.is_active}
                      onCheckedChange={(checked) => toggleApiKey(key.id, checked)}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir API Key?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Todas as integrações usando esta chave deixarão de funcionar.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteApiKey(key.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimas Requisições</CardTitle>
          <CardDescription>
            Histórico das últimas chamadas à API
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usageLogs.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p>Nenhuma requisição registrada</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {usageLogs.slice(0, 20).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 text-sm border rounded"
                >
                  <div className="flex items-center gap-3">
                    {log.response_status >= 200 && log.response_status < 300 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <Badge variant="outline">{log.method}</Badge>
                    <span className="font-mono">{log.endpoint}</span>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>{log.response_time_ms}ms</span>
                    <span>{format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
