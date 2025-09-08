import { ReactNode } from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import { UserNav } from "./UserNav"
import { WhatsAppStatus } from "./WhatsAppStatus"

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background-secondary">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-16 bg-card border-b border-card-border flex items-center justify-between px-4 sm:px-6 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="hidden sm:block">
                <h1 className="text-xl font-semibold text-foreground">VehicleGuard Pro</h1>
                <p className="text-sm text-muted-foreground">Sistema de Gestão de Rastreamento</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <WhatsAppStatus />
              <UserNav />
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}