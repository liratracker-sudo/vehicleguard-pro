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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-lg",
        "bg-card border",
        "shadow-sm",
        "transition-all duration-200",
        "hover:shadow-md",
        isActive 
          ? "border-primary/30 hover:border-primary/50" 
          : "border-border/50 hover:border-border",
        className
      )}
    >
      <div className="relative p-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className={cn(
            "p-1.5 rounded-md text-white",
            iconBgColor
          )}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-foreground">{name}</h4>
            <div className={cn(
              "inline-flex items-center gap-1 px-1.5 rounded-full text-[10px] font-medium",
              isActive 
                ? "bg-primary/10 text-primary" 
                : "bg-muted/50 text-muted-foreground"
            )}>
              <span className={cn(
                "w-1 h-1 rounded-full",
                isActive ? "bg-primary" : "bg-muted-foreground/50"
              )} />
              {activeCount}/{totalCount}
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="space-y-0.5">
          {children}
        </div>
      </div>
    </motion.div>
  )
}