import { ReactNode } from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import { UserNav } from "./UserNav"
import { WhatsAppStatus } from "./WhatsAppStatus"
import { useEnsureAsaasWebhook } from "@/hooks/useEnsureAsaasWebhook"
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation"

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  useEnsureAsaasWebhook();
  return (
    <div className="min-h-screen relative">
      <BackgroundGradientAnimation
        gradientBackgroundStart="rgb(16, 20, 40)"
        gradientBackgroundEnd="rgb(0, 12, 36)"
        firstColor="59, 130, 246"
        secondColor="139, 92, 246"
        thirdColor="6, 182, 212"
        fourthColor="168, 85, 247"
        fifthColor="34, 197, 94"
        pointerColor="99, 102, 241"
        containerClassName="absolute inset-0 z-0"
      />
      <SidebarProvider>
        <div className="min-h-screen flex w-full relative z-10 bg-transparent">
          <AppSidebar />
          
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <header className="h-14 sm:h-16 bg-card/80 backdrop-blur-sm border-b border-card-border/50 flex items-center justify-between px-3 sm:px-6 shadow-sm card-futuristic flex-shrink-0">
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
            <main className="flex-1 p-3 sm:p-6 overflow-y-auto container-responsive text-foreground">
              <div className="w-full max-w-full">
                {children}
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  )
}