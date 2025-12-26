import { ReactNode } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  value: string | number
  icon: ReactNode
  trend?: {
    value: string
    isPositive?: boolean
  }
  variant?: 'default' | 'danger' | 'warning'
  className?: string
}

export function MetricCard({ 
  title, 
  value, 
  icon, 
  trend,
  variant = 'default',
  className 
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "stat-card relative overflow-hidden",
        variant === 'danger' && "border-destructive/30",
        variant === 'warning' && "border-amber-500/30",
        className
      )}
    >
      {/* Subtle gradient overlay based on variant */}
      <div className={cn(
        "absolute inset-0 opacity-10",
        variant === 'danger' && "bg-gradient-to-br from-destructive/20 to-transparent",
        variant === 'warning' && "bg-gradient-to-br from-amber-500/20 to-transparent",
        variant === 'default' && "bg-gradient-to-br from-primary/10 to-transparent"
      )} />
      
      <div className="relative flex items-center justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {title}
          </p>
          <p className={cn(
            "text-4xl font-bold tracking-tight",
            variant === 'danger' && "text-destructive",
            variant === 'warning' && "text-amber-500",
            variant === 'default' && "gradient-text"
          )}>
            {value}
          </p>
          {trend && (
            <p className={cn(
              "text-sm font-medium flex items-center gap-1",
              trend.isPositive ? "text-emerald-500" : "text-muted-foreground"
            )}>
              {trend.isPositive && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
              {trend.value}
            </p>
          )}
        </div>
        
        {/* Icon with glow effect */}
        <div className={cn(
          "relative p-4 rounded-2xl transition-all duration-300",
          variant === 'danger' && "bg-destructive/10 text-destructive",
          variant === 'warning' && "bg-amber-500/10 text-amber-500",
          variant === 'default' && "bg-primary/10 text-primary"
        )}>
          {icon}
          {/* Glow effect */}
          <div className={cn(
            "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-50 transition-opacity blur-xl",
            variant === 'danger' && "bg-destructive",
            variant === 'warning' && "bg-amber-500",
            variant === 'default' && "bg-primary"
          )} />
        </div>
      </div>
    </motion.div>
  )
}
