import { useState, useEffect } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  FileText, 
  DollarSign, 
  BarChart3,
  Settings,
  Car,
  Building2,
  Shield,
  UserPlus,
  Receipt,
  LogOut,
  ChevronRight
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/integrations/supabase/client"
import { useClientRegistrations } from "@/hooks/useClientRegistrations"

const navigation = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Clientes", url: "/clients", icon: Users },
  { title: "Cadastros Pendentes", url: "/registrations", icon: UserPlus, showBadge: true },
  { title: "Planos", url: "/plans", icon: CreditCard },
  { title: "Contratos", url: "/contracts", icon: FileText },
  { title: "Veículos", url: "/vehicles", icon: Car },
  { title: "Cobrança", url: "/billing", icon: DollarSign },
  { title: "Financeiro", url: "/financial", icon: BarChart3 },
  { title: "Contas a Pagar", url: "/expenses", icon: Receipt },
  { title: "Relatórios", url: "/reports", icon: FileText },
  { title: "White Label", url: "/white-label", icon: Building2 },
  { title: "Configurações", url: "/settings", icon: Settings },
]

const adminNavigation = [
  { title: "Administração", url: "/admin", icon: Shield },
]

export function AppSidebar() {
  const location = useLocation()
  const currentPath = location.pathname

  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [companyName, setCompanyName] = useState("GestaoTracker")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const { pendingCount } = useClientRegistrations()
  
  useEffect(() => {
    let isMounted = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      if (isMounted) {
        setUserEmail(user.email || "")
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, company_id, full_name')
        .eq('user_id', user.id)
        .single()
      
      if (!isMounted) return
      
      if (profile?.full_name) {
        setUserName(profile.full_name)
      }
      
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle()
      
      setIsSuperAdmin(!!userRole)
      
      if (profile?.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('name')
          .eq('id', profile.company_id)
          .single()
        
        if (company?.name && isMounted) {
          setCompanyName(company.name)
        }
        
        const { data: branding } = await supabase
          .from('company_branding')
          .select('logo_url')
          .eq('company_id', profile.company_id)
          .single()
        
        if (branding?.logo_url && isMounted) {
          setLogoUrl(branding.logo_url)
        }
      }
    })()
    return () => { isMounted = false }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Sidebar className="w-56 border-r border-slate-200 shadow-sm">
      {/* Header com logo */}
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
        {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={`${companyName} Logo`}
              className="w-10 h-10 rounded-lg object-contain"
            />
          ) : (
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Car className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <span className="font-semibold text-slate-700 text-sm truncate">
            {companyName}
          </span>
        </div>
      </SidebarHeader>

      <Separator className="bg-slate-200" />

      {/* Menu principal - lista única */}
      <SidebarContent className="px-2 py-3">
        <SidebarMenu>
          {navigation.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild className="h-9" isActive={currentPath === item.url}>
                <NavLink to={item.url} className="flex items-center gap-2 w-full">
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate text-sm">{item.title}</span>
                  {item.showBadge && pendingCount > 0 && (
                    <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-xs">
                      {pendingCount}
                    </Badge>
                  )}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          
          {/* Admin - apenas se super admin */}
          {isSuperAdmin && adminNavigation.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild className="h-9" isActive={currentPath === item.url}>
                <NavLink to={item.url} className="flex items-center gap-2 w-full">
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate text-sm">{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer com informações do usuário */}
      <SidebarFooter className="mt-auto border-t border-slate-200 p-3">
        <div 
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
          onClick={handleLogout}
        >
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-primary/20 text-primary text-xs">
              {getInitials(userName || userEmail)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">
              {userName || "Usuário"}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {userEmail}
            </p>
          </div>
          <LogOut className="w-4 h-4 text-slate-400 shrink-0" />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
