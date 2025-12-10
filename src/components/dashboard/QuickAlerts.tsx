import { AlertCircle, Clock, CheckCircle2, TrendingDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

interface QuickAlertsProps {
  overdueCount: number
  overdueAmount: number
  upcomingCount: number
  defaultRate: number
}

export function QuickAlerts({ overdueCount, overdueAmount, upcomingCount, defaultRate }: QuickAlertsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const alerts = [
    {
      id: 'default-rate',
      icon: TrendingDown,
      label: `Taxa de inadimplência: ${defaultRate.toFixed(1)}%`,
      sublabel: defaultRate > 10 ? 'Acima do recomendado (10%)' : undefined,
      variant: defaultRate > 10 ? 'danger' : defaultRate > 5 ? 'warning' : 'success',
      show: defaultRate > 5
    },
    {
      id: 'overdue',
      icon: AlertCircle,
      label: `${overdueCount} cobrança${overdueCount !== 1 ? 's' : ''} vencida${overdueCount !== 1 ? 's' : ''}`,
      sublabel: overdueCount > 0 ? formatCurrency(overdueAmount) : undefined,
      variant: overdueCount > 0 ? 'danger' : 'success',
      show: overdueCount > 0
    },
    {
      id: 'upcoming',
      icon: Clock,
      label: `${upcomingCount} vence${upcomingCount !== 1 ? 'm' : ''} nos próximos 7 dias`,
      variant: upcomingCount > 0 ? 'warning' : 'success',
      show: upcomingCount > 0
    }
  ];

  const visibleAlerts = alerts.filter(a => a.show);
  const hasIssues = visibleAlerts.length > 0;

  if (!hasIssues) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-emerald-700">
              Tudo em dia! Nenhuma pendência.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          Atenção Necessária
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {visibleAlerts.map((alert) => (
            <Link 
              key={alert.id}
              to="/billing"
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-colors",
                alert.variant === 'danger' && "bg-destructive/10 hover:bg-destructive/15",
                alert.variant === 'warning' && "bg-amber-500/10 hover:bg-amber-500/15",
                alert.variant === 'success' && "bg-emerald-500/10 hover:bg-emerald-500/15"
              )}
            >
              <alert.icon className={cn(
                "h-5 w-5",
                alert.variant === 'danger' && "text-destructive",
                alert.variant === 'warning' && "text-amber-600",
                alert.variant === 'success' && "text-emerald-600"
              )} />
              <div className="flex-1">
                <p className={cn(
                  "text-sm font-medium",
                  alert.variant === 'danger' && "text-destructive",
                  alert.variant === 'warning' && "text-amber-700",
                  alert.variant === 'success' && "text-emerald-700"
                )}>
                  {alert.label}
                </p>
                {alert.sublabel && (
                  <p className="text-xs text-muted-foreground">
                    {alert.sublabel}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
