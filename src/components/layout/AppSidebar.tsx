import { useState, useEffect } from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
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
  ChevronRight,
  ChevronDown,
  User,
  UserCheck
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { supabase } from "@/integrations/supabase/client"
import { useClientRegistrations } from "@/hooks/useClientRegistrations"
import { cn } from "@/lib/utils"

// Menu groups with logical organization following the operational flow:
// Cliente → Veículos → Contrato → Cobrança
const menuGroups = [
  {
    label: "Principal",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Clientes", url: "/clients", icon: Users },
      { title: "Cadastros Pendentes", url: "/registrations", icon: UserPlus, showBadge: true },
      { title: "Vendedores", url: "/sellers", icon: UserCheck },
    ]
  },
  {
    label: "Gestão",
    items: [
      { title: "Veículos", url: "/vehicles", icon: Car },
      { title: "Contratos", url: "/contracts", icon: FileText },
      { title: "Planos", url: "/plans", icon: CreditCard },
    ]
  },
  {
    label: "Financeiro",
    items: [
      { title: "Cobrança", url: "/billing", icon: DollarSign },
      { title: "Financeiro", url: "/financial", icon: BarChart3 },
      { title: "Contas a Pagar", url: "/expenses", icon: Receipt },
      { title: "Relatórios", url: "/reports", icon: FileText },
    ]
  },
  {
    label: "Sistema",
    items: [
      { title: "White Label", url: "/white-label", icon: Building2 },
      { title: "Configurações", url: "/settings", icon: Settings },
    ]
  },
]

const adminNavigation = [
  { title: "Administração", url: "/admin", icon: Shield },
]

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentPath = location.pathname

  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [companyName, setCompanyName] = useState("GestaoTracker")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Principal: true,
    Financeiro: true,
    Gestão: true,
    Sistema: true,
  })
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

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const isItemActive = (url: string) => currentPath === url

  return (
    <Sidebar className="w-60 border-r-0">
      {/* Glassmorphism Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/90 to-background/95 backdrop-blur-xl" />
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-border/50 to-transparent" />
      
      {/* Header with Logo */}
      <SidebarHeader className="relative p-4 pb-3">
        <div className="flex items-center gap-3 group">
          {logoUrl ? (
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <img 
                src={logoUrl} 
                alt={`${companyName} Logo`}
                className="relative w-11 h-11 rounded-xl object-contain shadow-lg ring-1 ring-white/10"
              />
            </div>
          ) : (
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative w-11 h-11 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg ring-1 ring-white/10">
                <Car className="w-5 h-5 text-primary-foreground" />
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-foreground text-sm truncate block bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              {companyName}
            </span>
            <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
              Sistema de Gestão
            </span>
          </div>
        </div>
        {/* Gradient border bottom */}
        <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
      </SidebarHeader>

      {/* Menu Content */}
      <SidebarContent className="relative px-3 py-2 overflow-y-auto scrollbar-thin">
        {menuGroups.map((group, groupIndex) => (
          <Collapsible 
            key={group.label}
            open={openGroups[group.label]}
            onOpenChange={() => toggleGroup(group.label)}
            className="mb-1"
          >
            <CollapsibleTrigger className="w-full group/trigger">
              <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-accent/50 transition-colors">
                <span className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-widest">
                  {group.label}
                </span>
                <ChevronDown className={cn(
                  "w-3 h-3 text-muted-foreground/50 transition-transform duration-200",
                  openGroups[group.label] && "rotate-180"
                )} />
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-0.5 mt-1">
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = isItemActive(item.url)
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild className="h-auto p-0">
                        <NavLink 
                          to={item.url} 
                          className={cn(
                            "group/item relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                            "hover:bg-accent/60 hover:translate-x-1",
                            isActive && "bg-primary/10 hover:bg-primary/15"
                          )}
                        >
                          {/* Active indicator */}
                          {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-primary via-primary to-primary/50 rounded-full shadow-lg shadow-primary/30" />
                          )}
                          
                          {/* Icon container */}
                          <div className={cn(
                            "relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
                            isActive 
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                              : "bg-accent/50 text-muted-foreground group-hover/item:bg-accent group-hover/item:text-foreground group-hover/item:scale-110"
                          )}>
                            <item.icon className="w-4 h-4" />
                            {isActive && (
                              <div className="absolute inset-0 bg-primary/20 rounded-lg blur-md animate-pulse" />
                            )}
                          </div>
                          
                          {/* Label */}
                          <span className={cn(
                            "flex-1 text-sm font-medium transition-colors",
                            isActive ? "text-foreground" : "text-muted-foreground group-hover/item:text-foreground"
                          )}>
                            {item.title}
                          </span>
                          
                          {/* Badge */}
                          {item.showBadge && pendingCount > 0 && (
                            <Badge 
                              variant="destructive" 
                              className="h-5 min-w-5 px-1.5 text-xs font-bold animate-pulse shadow-lg shadow-destructive/30"
                            >
                              {pendingCount}
                            </Badge>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </CollapsibleContent>
            
            {/* Group separator */}
            {groupIndex < menuGroups.length - 1 && (
              <div className="mx-2 mt-2 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />
            )}
          </Collapsible>
        ))}
        
        {/* Admin Section */}
        {isSuperAdmin && (
          <>
            <div className="mx-2 my-2 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />
            <div className="px-2 py-1">
              <span className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-widest">
                Admin
              </span>
            </div>
            <SidebarMenu>
              {adminNavigation.map((item) => {
                const isActive = isItemActive(item.url)
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className="h-auto p-0">
                      <NavLink 
                        to={item.url} 
                        className={cn(
                          "group/item relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                          "hover:bg-accent/60 hover:translate-x-1",
                          isActive && "bg-primary/10 hover:bg-primary/15"
                        )}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-primary via-primary to-primary/50 rounded-full shadow-lg shadow-primary/30" />
                        )}
                        
                        <div className={cn(
                          "relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
                          isActive 
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                            : "bg-amber-500/10 text-amber-500 group-hover/item:bg-amber-500/20 group-hover/item:scale-110"
                        )}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        
                        <span className={cn(
                          "flex-1 text-sm font-medium transition-colors",
                          isActive ? "text-foreground" : "text-muted-foreground group-hover/item:text-foreground"
                        )}>
                          {item.title}
                        </span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </>
        )}
      </SidebarContent>

      {/* Footer with User Info */}
      <SidebarFooter className="relative mt-auto p-3">
        {/* Top gradient border */}
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="group flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/60 cursor-pointer transition-all duration-200 hover:translate-x-0.5">
              {/* Avatar with status */}
              <div className="relative">
                <Avatar className="w-10 h-10 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all duration-200">
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-sm font-semibold">
                    {getInitials(userName || userEmail)}
                  </AvatarFallback>
                </Avatar>
                {/* Online status indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-background shadow-lg shadow-emerald-500/30" />
              </div>
              
              {/* User info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {userName || "Usuário"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {userEmail}
                </p>
              </div>
              
              {/* Chevron */}
              <div className="w-6 h-6 rounded-md bg-accent/50 flex items-center justify-center group-hover:bg-accent transition-colors">
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="right" className="w-56 bg-background/95 backdrop-blur-xl border-border/50">
            <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer gap-2">
              <User className="w-4 h-4" />
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive gap-2">
              <LogOut className="w-4 h-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
