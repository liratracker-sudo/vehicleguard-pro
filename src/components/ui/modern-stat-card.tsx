import { ReactNode } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown } from "lucide-react"

interface ModernStatCardProps {
  title: string
  value: string | number
  icon: ReactNode
  description?: string
  trend?: {
    value: string | number
    isPositive?: boolean
    label?: string
  }
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
  isLoading?: boolean
}

const variantStyles = {
  default: {
    iconBg: "bg-gradient-to-br from-primary/20 to-primary/5",
    iconColor: "text-primary",
    glow: "group-hover:shadow-primary/20",
    border: "group-hover:border-primary/30",
    valueColor: "text-foreground"
  },
  success: {
    iconBg: "bg-gradient-to-br from-emerald-500/20 to-emerald-500/5",
    iconColor: "text-emerald-500",
    glow: "group-hover:shadow-emerald-500/20",
    border: "group-hover:border-emerald-500/30",
    valueColor: "text-emerald-500"
  },
  warning: {
    iconBg: "bg-gradient-to-br from-amber-500/20 to-amber-500/5",
    iconColor: "text-amber-500",
    glow: "group-hover:shadow-amber-500/20",
    border: "group-hover:border-amber-500/30",
    valueColor: "text-amber-500"
  },
  danger: {
    iconBg: "bg-gradient-to-br from-destructive/20 to-destructive/5",
    iconColor: "text-destructive",
    glow: "group-hover:shadow-destructive/20",
    border: "group-hover:border-destructive/30",
    valueColor: "text-destructive"
  },
  info: {
    iconBg: "bg-gradient-to-br from-sky-500/20 to-sky-500/5",
    iconColor: "text-sky-500",
    glow: "group-hover:shadow-sky-500/20",
    border: "group-hover:border-sky-500/30",
    valueColor: "text-sky-500"
  }
}

export function ModernStatCard({ 
  title, 
  value, 
  icon, 
  description,
  trend,
  variant = 'default',
  className,
  isLoading = false
}: ModernStatCardProps) {
  const styles = variantStyles[variant]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-card via-card to-card/95",
        "backdrop-blur-xl border border-border/50",
        "shadow-lg shadow-black/5",
        "transition-all duration-300",
        "hover:shadow-xl",
        styles.glow,
        styles.border,
        className
      )}
    >
      {/* Animated background gradient */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
        "bg-gradient-to-br from-primary/5 via-transparent to-transparent"
      )} />
      
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          {/* Content */}
          <div className="flex-1 min-w-0 space-y-3">
            <p className="text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            
            {isLoading ? (
              <div className="h-9 w-24 bg-muted/50 rounded-lg animate-pulse" />
            ) : (
              <p className={cn(
                "text-3xl sm:text-4xl font-bold tracking-tight",
                styles.valueColor
              )}>
                {value}
              </p>
            )}
            
            {/* Trend indicator */}
            {trend && !isLoading && (
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                  trend.isPositive 
                    ? "bg-emerald-500/10 text-emerald-500" 
                    : "bg-destructive/10 text-destructive"
                )}>
                  {trend.isPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>{trend.value}</span>
                </div>
                {trend.label && (
                  <span className="text-xs text-muted-foreground">{trend.label}</span>
                )}
              </div>
            )}
            
            {description && !isLoading && (
              <p className="text-xs text-muted-foreground/70">
                {description}
              </p>
            )}
          </div>
          
          {/* Icon container with glow */}
          <div className="relative">
            <div className={cn(
              "relative p-3 sm:p-4 rounded-2xl transition-all duration-300",
              "group-hover:scale-110",
              styles.iconBg,
              styles.iconColor
            )}>
              {icon}
            </div>
            {/* Glow effect */}
            <div className={cn(
              "absolute inset-0 rounded-2xl blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-500",
              styles.iconBg
            )} />
          </div>
        </div>
      </div>
    </motion.div>
  )
}