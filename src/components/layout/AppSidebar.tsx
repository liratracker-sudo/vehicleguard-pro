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
  Receipt
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/integrations/supabase/client"
import { useClientRegistrations } from "@/hooks/useClientRegistrations"

const navigation = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    group: "principal"
  },
  {
    title: "Clientes",
    url: "/clients",
    icon: Users,
    group: "gestao"
  },
  {
    title: "Cadastros Pendentes",
    url: "/registrations",
    icon: UserPlus,
    group: "gestao"
  },
  {
    title: "Planos",
    url: "/plans",
    icon: CreditCard,
    group: "gestao"
  },
  {
    title: "Contratos",
    url: "/contracts",
    icon: FileText,
    group: "gestao"
  },
  {
    title: "Veículos",
    url: "/vehicles",
    icon: Car,
    group: "gestao"
  },
  {
    title: "Cobrança",
    url: "/billing",
    icon: DollarSign,
    group: "financeiro"
  },
  {
    title: "Financeiro",
    url: "/financial",
    icon: BarChart3,
    group: "financeiro"
  },
  {
    title: "Contas a Pagar",
    url: "/expenses",
    icon: Receipt,
    group: "financeiro"
  },
  {
    title: "Relatórios",
    url: "/reports",
    icon: FileText,
    group: "relatorios"
  },
  {
    title: "White Label",
    url: "/white-label",
    icon: Building2,
    group: "configuracoes"
  },
  {
    title: "Configurações",
    url: "/settings",
    icon: Settings,
    group: "configuracoes"
  },
  {
    title: "Administração",
    url: "/admin",
    icon: Shield,
    group: "admin",
    requireSuperAdmin: true
  }
]

const groupedNavigation = {
  principal: navigation.filter(item => item.group === "principal"),
  gestao: navigation.filter(item => item.group === "gestao"),
  financeiro: navigation.filter(item => item.group === "financeiro"),
  relatorios: navigation.filter(item => item.group === "relatorios"),
  configuracoes: navigation.filter(item => item.group === "configuracoes"),
  admin: navigation.filter(item => item.group === "admin"),
}

export function AppSidebar() {
  const location = useLocation()
  const currentPath = location.pathname

  const isActive = (path: string) => currentPath === path
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-primary/10 text-primary font-semibold border-r-2 border-primary" 
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"

  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [companyName, setCompanyName] = useState("GestaoTracker")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const { pendingCount } = useClientRegistrations()
  
  useEffect(() => {
    let isMounted = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, company_id')
        .eq('user_id', user.id)
        .single()
      
      if (!isMounted) return
      
      // Verificar se o usuário tem role de super_admin na tabela user_roles
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle()
      
      setIsSuperAdmin(!!userRole)
      
      if (profile?.company_id) {
        // Buscar dados da empresa
        const { data: company } = await supabase
          .from('companies')
          .select('name')
          .eq('id', profile.company_id)
          .single()
        
        if (company?.name && isMounted) {
          setCompanyName(company.name)
        }
        
        // Buscar logo do branding
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

  return (
    <Sidebar className="w-64 sm:w-64" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-center px-3 sm:px-4 py-4">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={`${companyName} Logo`}
              className="w-18 h-18 rounded-lg object-contain"
            />
          ) : (
            <div className="w-18 h-18 bg-gradient-primary rounded-lg flex items-center justify-center icon-hover">
              <Car className="w-10 h-10 text-white" />
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Principal */}
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {groupedNavigation.principal.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls}>
                      <item.icon className="w-4 h-4 icon-hover" />
                      <span className="truncate">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Gestão */}
        <SidebarGroup>
          <SidebarGroupLabel>Gestão</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {groupedNavigation.gestao.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                      {item.url === '/registrations' && pendingCount > 0 && (
                        <Badge variant="destructive" className="ml-auto">
                          {pendingCount}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Financeiro */}
        <SidebarGroup>
          <SidebarGroupLabel>Financeiro</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {groupedNavigation.financeiro.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Relatórios */}
        <SidebarGroup>
          <SidebarGroupLabel>Relatórios</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {groupedNavigation.relatorios.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Configurações */}
        <SidebarGroup>
          <SidebarGroupLabel>Configurações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {groupedNavigation.configuracoes.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Administração */}
        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {groupedNavigation.admin.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavCls}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  )
}