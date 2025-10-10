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
    <div className="min-h-screen relative bg-slate-950">
      <FlickeringGrid
        className="z-0 absolute inset-0 size-full"
        squareSize={4}
        gridGap={6}
        color="rgb(30, 41, 59)"
        maxOpacity={0.5}
        flickerChance={0.2}
      />
      <SidebarProvider>
        <div className="min-h-screen flex w-full relative z-10 bg-transparent">
          <AppSidebar />
          
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <header className="h-14 sm:h-16 bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between px-2 sm:px-6 shadow-lg flex-shrink-0 gap-2">
              <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                <SidebarTrigger className="text-slate-400 hover:text-slate-100 transition-colors flex-shrink-0" />
                <div className="hidden sm:block min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent truncate">VehicleGuard Pro</h1>
                  <p className="text-xs sm:text-sm text-slate-400 truncate">Sistema de Gestão de Rastreamento</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1 sm:gap-4 flex-shrink-0">
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