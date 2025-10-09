import { formatDateBR, formatDateTimeBR, formatTimeBR } from "@/lib/timezone";

interface DateDisplayProps {
  date: Date | string | null;
  format?: 'date' | 'datetime' | 'time';
  className?: string;
}

/**
 * Componente para exibir datas no formato brasileiro considerando fuso horário de Brasília
 */
export function DateDisplay({ date, format = 'date', className }: DateDisplayProps) {
  if (!date) return <span className={className}>-</span>;

  let formattedDate: string;
  
  switch (format) {
    case 'datetime':
      formattedDate = formatDateTimeBR(date);
      break;
    case 'time':
      formattedDate = formatTimeBR(date);
      break;
    default:
      formattedDate = formatDateBR(date);
  }

  return <span className={className}>{formattedDate}</span>;
}
