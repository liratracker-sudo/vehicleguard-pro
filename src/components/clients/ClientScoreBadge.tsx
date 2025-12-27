import { TrendingUp, TrendingDown, AlertTriangle, Star, Minus, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ClientScoreBadgeProps {
  score: number | null | undefined;
  totalPayments?: number;
  paidOnTime?: number;
  paidLate?: number;
  overdueCount?: number;
  avgDaysLate?: number;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

type ScoreCategory = 'excellent' | 'good' | 'regular' | 'critical' | 'unknown';

function getScoreCategory(score: number | null | undefined): ScoreCategory {
  if (score === null || score === undefined) return 'unknown';
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'regular';
  return 'critical';
}

function getCategoryConfig(category: ScoreCategory) {
  const configs = {
    excellent: {
      label: 'Excelente',
      bgColor: 'bg-emerald-500/10',
      textColor: 'text-emerald-500',
      borderColor: 'border-emerald-500/30',
      icon: Star,
      description: 'Cliente pagador exemplar',
    },
    good: {
      label: 'Bom',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-500',
      borderColor: 'border-blue-500/30',
      icon: TrendingUp,
      description: 'Cliente bom pagador',
    },
    regular: {
      label: 'Regular',
      bgColor: 'bg-amber-500/10',
      textColor: 'text-amber-500',
      borderColor: 'border-amber-500/30',
      icon: Minus,
      description: 'Atenção aos pagamentos',
    },
    critical: {
      label: 'Crítico',
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-500',
      borderColor: 'border-red-500/30',
      icon: AlertTriangle,
      description: 'Alto risco de inadimplência',
    },
    unknown: {
      label: 'N/D',
      bgColor: 'bg-muted',
      textColor: 'text-muted-foreground',
      borderColor: 'border-border',
      icon: HelpCircle,
      description: 'Score não calculado',
    },
  };
  return configs[category];
}

export function ClientScoreBadge({
  score,
  totalPayments,
  paidOnTime,
  paidLate,
  overdueCount,
  avgDaysLate,
  showDetails = true,
  size = 'md',
  className,
}: ClientScoreBadgeProps) {
  const category = getScoreCategory(score);
  const config = getCategoryConfig(category);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'h-6 px-1.5 text-xs gap-1',
    md: 'h-7 px-2 text-sm gap-1.5',
    lg: 'h-8 px-3 text-base gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  const badge = (
    <div
      className={cn(
        'inline-flex items-center rounded-full border font-medium transition-colors',
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizeClasses[size],
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      <span>{score !== null && score !== undefined ? score : 'N/D'}</span>
    </div>
  );

  if (!showDetails) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="font-semibold">{config.label}</span>
              <span className={cn('text-lg font-bold', config.textColor)}>
                {score !== null && score !== undefined ? score : 'N/D'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            
            {totalPayments !== undefined && totalPayments > 0 && (
              <div className="pt-2 border-t border-border space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total de pagamentos:</span>
                  <span className="font-medium">{totalPayments}</span>
                </div>
                {paidOnTime !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">No prazo:</span>
                    <span className="font-medium text-emerald-500">{paidOnTime}</span>
                  </div>
                )}
                {paidLate !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Com atraso:</span>
                    <span className="font-medium text-amber-500">{paidLate}</span>
                  </div>
                )}
                {overdueCount !== undefined && overdueCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Em atraso atual:</span>
                    <span className="font-medium text-red-500">{overdueCount}</span>
                  </div>
                )}
                {avgDaysLate !== undefined && avgDaysLate > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Média de atraso:</span>
                    <span className="font-medium">{avgDaysLate.toFixed(1)} dias</span>
                  </div>
                )}
              </div>
            )}
            
            {(totalPayments === undefined || totalPayments === 0) && (
              <p className="text-xs text-muted-foreground italic pt-1">
                Sem pagamentos nos últimos 3 meses
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
