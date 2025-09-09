import { ReactNode } from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import { UserNav } from "./UserNav"
import { WhatsAppStatus } from "./WhatsAppStatus"
import { useEnsureAsaasWebhook } from "@/hooks/useEnsureAsaasWebhook"

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  useEnsureAsaasWebhook();
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background-secondary overflow-x-hidden">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-14 sm:h-16 bg-card border-b border-card-border flex items-center justify-between px-3 sm:px-6 shadow-sm card-futuristic">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground icon-hover flex-shrink-0" />
              <div className="hidden xs:block min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">VehicleGuard Pro</h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Sistema de Gestão de Rastreamento</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <WhatsAppStatus />
              <UserNav />
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-3 sm:p-6 overflow-auto container-responsive">
            <div className="w-full max-w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}