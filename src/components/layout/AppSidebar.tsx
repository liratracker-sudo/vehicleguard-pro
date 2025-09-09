import { useState } from "react"
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
  Shield
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

const navigation = [
  {
    title: "Dashboard",
    url: "/",
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

  return (
    <Sidebar className="w-64" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
            <Car className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-sidebar-foreground">VehicleGuard</h2>
            <p className="text-xs text-muted-foreground">Pro</p>
          </div>
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
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
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
      </SidebarContent>
    </Sidebar>
  )
}