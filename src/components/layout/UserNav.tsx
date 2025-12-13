import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { User as UserIcon, LogOut, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { supabase } from "@/integrations/supabase/client"

export function UserNav() {
  const [displayUser, setDisplayUser] = useState<{
    name: string
    email: string
    avatar: string
    role?: string
  } | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const email = session.user.email ?? ""
        const name = (session.user.user_metadata as any)?.full_name ?? email?.split("@")[0] ?? "Usuário"
        setDisplayUser({ name, email: email || "", avatar: "", role: "Usuário" })
      } else {
        setDisplayUser(null)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const email = session.user.email ?? ""
        const name = (session.user.user_metadata as any)?.full_name ?? email?.split("@")[0] ?? "Usuário"
        setDisplayUser({ name, email: email || "", avatar: "", role: "Usuário" })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    // Clear all local storage and session data
    await supabase.auth.signOut({ scope: 'local' })
    
    // Clear any cached data
    localStorage.clear()
    sessionStorage.clear()
    
    // Force reload to clear all React state and caches
    window.location.href = "/"
  }

  if (!displayUser) {
    return (
      <Button variant="outline" onClick={() => navigate("/auth")}>Entrar</Button>
    )
  }

  const initials = displayUser.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage src={displayUser.avatar} alt={displayUser.name} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayUser.name}</p>
            <p className="text-xs leading-none text-muted-foreground">{displayUser.email}</p>
            {displayUser.role && (
              <p className="text-xs leading-none text-muted-foreground">{displayUser.role}</p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/profile')}>
          <UserIcon className="mr-2 h-4 w-4" />
          <span>Perfil</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/settings')}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Configurações</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}