import { ReactNode } from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import { UserNav } from "./UserNav"
import { WhatsAppStatus } from "./WhatsAppStatus"
import { WhatsAppAlert } from "@/components/alerts/WhatsAppAlert"
import { useEnsureAsaasWebhook } from "@/hooks/useEnsureAsaasWebhook"
import { FlickeringGrid } from "@/components/ui/flickering-grid"

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  useEnsureAsaasWebhook();
  return (
    <div className="min-h-screen relative bg-background">
      <FlickeringGrid
        className="z-0 absolute inset-0 size-full dark:opacity-100 light:opacity-20"
        squareSize={4}
        gridGap={6}
        color="hsl(var(--muted))"
        maxOpacity={0.5}
        flickerChance={0.2}
      />
      <SidebarProvider>
        <div className="min-h-screen flex w-full relative z-10 bg-transparent">
          <AppSidebar />
          
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <header className="h-14 sm:h-16 bg-card/50 backdrop-blur-sm border-b border-border flex items-center justify-between px-2 sm:px-6 shadow-lg flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-shrink-0">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10" />
                <div className="hidden sm:block min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent truncate">VehicleGuard Pro</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Sistema de Gestão de Rastreamento</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 ml-auto">
                <WhatsAppStatus />
                <UserNav />
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-3 sm:p-6 overflow-y-auto container-responsive text-foreground">
              <div className="w-full max-w-full">
                <WhatsAppAlert />
                {children}
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  )
}