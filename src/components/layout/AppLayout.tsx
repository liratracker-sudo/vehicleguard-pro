import { ReactNode } from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-sidebar">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 bg-content border-b border-border/50 flex items-center px-4 flex-shrink-0">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
          </header>

          <main className="flex-1 bg-content overflow-y-auto overflow-x-hidden">
            <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
