import { Badge } from "@/components/ui/badge"
import { daysUntil, formatDateBR } from "@/lib/timezone"

interface DueDateIndicatorProps {
  dueDate: string
  status: string
}

type IndicatorInfo = {
  text: string
  variant: 'warning' | 'orange' | 'destructive'
} | null

const getDueDateInfo = (dueDate: string, status: string): IndicatorInfo => {
  // Não mostrar indicador para cobranças pagas
  if (status === 'paid') return null
  
  const days = daysUntil(dueDate)
  
  if (days < 0) {
    // Vencido - dias em atraso
    const daysOverdue = Math.abs(days)
    return { 
      text: `${daysOverdue} ${daysOverdue === 1 ? 'dia' : 'dias'} em atraso`,
      variant: 'destructive'
    }
  } else if (days === 0) {
    return { text: 'Vence hoje', variant: 'destructive' }
  } else if (days <= 2) {
    return { text: `Vence em ${days} ${days === 1 ? 'dia' : 'dias'}`, variant: 'destructive' }
  } else if (days <= 4) {
    return { text: `Vence em ${days} dias`, variant: 'orange' }
  } else if (days <= 7) {
    return { text: `Vence em ${days} dias`, variant: 'warning' }
  }
  
  return null // Mais de 7 dias - não mostra indicador
}

export function DueDateIndicator({ dueDate, status }: DueDateIndicatorProps) {
  const info = getDueDateInfo(dueDate, status)
  
  if (!info) {
    return <div>{formatDateBR(dueDate)}</div>
  }
  
  const variantClasses = {
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700',
    orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-300 dark:border-orange-700',
    destructive: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700'
  }
  
  return (
    <div className="space-y-1">
      <div>{formatDateBR(dueDate)}</div>
      <Badge 
        variant="outline" 
        className={`text-xs font-medium ${variantClasses[info.variant]}`}
      >
        {info.text}
      </Badge>
    </div>
  )
}
