import { ReactNode } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Settings, CheckCircle2, Circle } from "lucide-react"
import { Button } from "./button"

interface IntegrationCardProps {
  name: string
  description: string
  icon: ReactNode
  iconColor?: string
  iconBgColor?: string
  isActive?: boolean
  onConfigure?: () => void
  className?: string
  badge?: ReactNode
}

export function IntegrationCard({
  name,
  description,
  icon,
  iconColor = "text-primary",
  iconBgColor = "bg-primary/10",
  isActive = false,
  onConfigure,
  className,
  badge
}: IntegrationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-card via-card to-card/95",
        "backdrop-blur-xl border",
        "shadow-lg shadow-black/5",
        "transition-all duration-300",
        "hover:shadow-xl",
        isActive 
          ? "border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-emerald-500/10" 
          : "border-border/50 hover:border-primary/30 hover:shadow-primary/10",
        className
      )}
    >
      {/* Active status glow */}
      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent" />
      )}
      
      {/* Top accent line */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent transition-opacity duration-500",
        isActive 
          ? "via-emerald-500/50 opacity-100" 
          : "via-primary/50 opacity-0 group-hover:opacity-100"
      )} />
      
      <div className="relative p-5 sm:p-6">
        {/* Header with icon and settings */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            {/* Icon container */}
            <div className="relative">
              <div className={cn(
                "p-3 rounded-xl transition-all duration-300",
                "group-hover:scale-110",
                iconBgColor,
                iconColor
              )}>
                {icon}
              </div>
              {/* Status indicator */}
              <div className={cn(
                "absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center",
                "border-2 border-card",
                isActive ? "bg-emerald-500" : "bg-muted"
              )}>
                {isActive ? (
                  <CheckCircle2 className="w-3 h-3 text-white" />
                ) : (
                  <Circle className="w-2 h-2 text-muted-foreground" />
                )}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-foreground truncate">{name}</h4>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {description}
              </p>
            </div>
          </div>
          
          {/* Settings button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onConfigure}
            className={cn(
              "h-9 w-9 rounded-xl shrink-0",
              "opacity-60 group-hover:opacity-100",
              "hover:bg-primary/10 hover:text-primary",
              "transition-all duration-300"
            )}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Status badge */}
        <div className="flex items-center gap-2">
          {badge || (
            <div className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
              "transition-all duration-300",
              isActive 
                ? "bg-emerald-500/10 text-emerald-500 shadow-sm shadow-emerald-500/20" 
                : "bg-muted/50 text-muted-foreground"
            )}>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"
              )} />
              {isActive ? "Configurado" : "Não Configurado"}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}