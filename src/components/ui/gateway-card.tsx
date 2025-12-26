import { ReactNode } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface GatewayCardProps {
  name: string
  icon: ReactNode
  iconBgColor?: string
  activeCount: number
  totalCount: number
  children: ReactNode
  className?: string
}

export function GatewayCard({
  name,
  icon,
  iconBgColor = "bg-primary",
  activeCount,
  totalCount,
  children,
  className
}: GatewayCardProps) {
  const isActive = activeCount > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-card via-card to-card/95",
        "backdrop-blur-xl border",
        "shadow-lg shadow-black/5",
        "transition-all duration-300",
        "hover:shadow-xl",
        isActive 
          ? "border-primary/30 hover:border-primary/50 hover:shadow-primary/10" 
          : "border-border/50 hover:border-border",
        className
      )}
    >
      {/* Top accent line */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent",
        isActive ? "opacity-60" : "opacity-0 group-hover:opacity-100",
        "transition-opacity duration-500"
      )} />
      
      <div className="relative p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className={cn(
            "p-2.5 rounded-xl text-white transition-all duration-300",
            "group-hover:scale-105 group-hover:shadow-lg",
            iconBgColor
          )}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground">{name}</h4>
            <div className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium mt-1",
              isActive 
                ? "bg-primary/10 text-primary" 
                : "bg-muted/50 text-muted-foreground"
            )}>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                isActive ? "bg-primary animate-pulse" : "bg-muted-foreground/50"
              )} />
              {activeCount} de {totalCount} ativo(s)
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="space-y-3">
          {children}
        </div>
      </div>
    </motion.div>
  )
}