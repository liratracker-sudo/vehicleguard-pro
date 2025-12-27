import { AlertCircle, Clock, CheckCircle2, TrendingDown, ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
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
      show: overdueCount > 0,
      link: '/billing?filter=overdue'
    },
    {
      id: 'upcoming',
      icon: Clock,
      label: `${upcomingCount} vence${upcomingCount !== 1 ? 'm' : ''} nos próximos 7 dias`,
      variant: upcomingCount > 0 ? 'warning' : 'success',
      show: upcomingCount > 0,
      link: '/billing?filter=upcoming_7days'
    }
  ];

  const visibleAlerts = alerts.filter(a => a.show);
  const hasIssues = visibleAlerts.length > 0;

  if (!hasIssues) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card border-emerald-500/30 p-5"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="font-semibold text-emerald-500">
              Tudo em dia!
            </p>
            <p className="text-sm text-muted-foreground">
              Nenhuma pendência encontrada
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden"
    >
      <div className="p-5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <AlertCircle className="h-5 w-5 text-amber-500" />
          </div>
          <h3 className="font-semibold text-foreground">
            Atenção Necessária
          </h3>
        </div>
      </div>
      
      <div className="p-3">
        <div className="space-y-2">
          {visibleAlerts.map((alert, index) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link 
                to={alert.link || '/billing'}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl transition-all duration-300 group",
                  alert.variant === 'danger' && "bg-destructive/5 hover:bg-destructive/10 border border-transparent hover:border-destructive/20",
                  alert.variant === 'warning' && "bg-amber-500/5 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20",
                  alert.variant === 'success' && "bg-emerald-500/5 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20"
                )}
              >
                <div className={cn(
                  "p-2.5 rounded-xl transition-all duration-300",
                  alert.variant === 'danger' && "bg-destructive/10 group-hover:bg-destructive/20",
                  alert.variant === 'warning' && "bg-amber-500/10 group-hover:bg-amber-500/20",
                  alert.variant === 'success' && "bg-emerald-500/10 group-hover:bg-emerald-500/20"
                )}>
                  <alert.icon className={cn(
                    "h-5 w-5",
                    alert.variant === 'danger' && "text-destructive",
                    alert.variant === 'warning' && "text-amber-500",
                    alert.variant === 'success' && "text-emerald-500"
                  )} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-medium",
                    alert.variant === 'danger' && "text-destructive",
                    alert.variant === 'warning' && "text-amber-600",
                    alert.variant === 'success' && "text-emerald-600"
                  )}>
                    {alert.label}
                  </p>
                  {alert.sublabel && (
                    <p className="text-sm text-muted-foreground">
                      {alert.sublabel}
                    </p>
                  )}
                </div>
                
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
