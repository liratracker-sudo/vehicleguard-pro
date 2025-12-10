import { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
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
    <Card className={cn(
      "transition-all hover:shadow-lg",
      variant === 'danger' && "border-destructive/50 bg-destructive/5",
      variant === 'warning' && "border-amber-500/50 bg-amber-500/5",
      className
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              {title}
            </p>
            <p className={cn(
              "text-3xl font-bold",
              variant === 'danger' && "text-destructive",
              variant === 'warning' && "text-amber-600",
              variant === 'default' && "text-foreground"
            )}>
              {value}
            </p>
            {trend && (
              <p className={cn(
                "text-sm font-medium",
                trend.isPositive ? "text-emerald-600" : "text-muted-foreground"
              )}>
                {trend.value}
              </p>
            )}
          </div>
          <div className={cn(
            "p-3 rounded-full",
            variant === 'danger' && "bg-destructive/10 text-destructive",
            variant === 'warning' && "bg-amber-500/10 text-amber-600",
            variant === 'default' && "bg-primary/10 text-primary"
          )}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
