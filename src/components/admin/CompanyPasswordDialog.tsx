import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Eye, EyeOff, Key } from "lucide-react"

interface CompanyPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string | null
  companyName: string
  hasPassword?: boolean
}

export function CompanyPasswordDialog({ 
  open, 
  onOpenChange, 
  companyId, 
  companyName, 
  hasPassword = false 
}: CompanyPasswordDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Limpar campos quando o dialog fechar
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPassword('')
      setConfirmPassword('')
      setShowPassword(false)
    }
    onOpenChange(newOpen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId || !password) return

    if (password !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive"
      })
      return
    }

    if (password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão inválida')

      const response = await fetch('https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/company-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: hasPassword ? 'update' : 'create',
          companyId,
          password
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao processar solicitação')
      }

      toast({
        title: "Sucesso",
        description: result.message
      })

      handleOpenChange(false)
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

  const handleDeletePassword = async () => {
    if (!companyId) return
    
    if (!confirm('Tem certeza que deseja remover a senha desta empresa?')) return

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão inválida')

      const response = await fetch('https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/company-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'delete',
          companyId
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao processar solicitação')
      }

      toast({
        title: "Sucesso",
        description: result.message
      })

      handleOpenChange(false)
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            {hasPassword ? 'Alterar Senha' : 'Definir Senha'}
          </DialogTitle>
          <DialogDescription>
            {hasPassword 
              ? `Altere a senha de acesso para ${companyName}`
              : `Defina uma senha de acesso para ${companyName}`
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password">Nova Senha *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a nova senha"
                required
                minLength={6}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirme a nova senha"
              required
              minLength={6}
            />
          </div>

          <div className="flex justify-between gap-2 pt-4">
            <div>
              {hasPassword && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleDeletePassword}
                  disabled={loading}
                >
                  Remover Senha
                </Button>
              )}
            </div>
            <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => handleOpenChange(false)}
                  disabled={loading}
                >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || !password || !confirmPassword}>
                {loading ? 'Salvando...' : (hasPassword ? 'Alterar' : 'Definir')}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}