import { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  value: string | number
  icon: ReactNode
  trend?: {
    value: string
    isPositive?: boolean
  }
  description?: string
  className?: string
}

export function MetricCard({ 
  title, 
  value, 
  icon, 
  trend, 
  description, 
  className 
}: MetricCardProps) {
  return (
    <Card className={cn("transition-fast hover:shadow-md", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-primary">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground mb-1">
          {value}
        </div>
        {trend && (
          <div className="flex items-center text-xs">
            <span 
              className={cn(
                "font-medium",
                trend.isPositive ? "text-success" : "text-destructive"
              )}
            >
              {trend.isPositive ? "+" : ""}{trend.value}
            </span>
            <span className="text-muted-foreground ml-1">vs mês anterior</span>
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}