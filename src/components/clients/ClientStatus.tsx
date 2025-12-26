import { cn } from "@/lib/utils"

interface ClientStatusProps {
  status: string
  className?: string
}

const statusConfig = {
  active: {
    label: "Ativo",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
  },
  suspended: {
    label: "Suspenso",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  },
  inactive: {
    label: "Inativo",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
  }
} as const

export function ClientStatus({ status, className }: ClientStatusProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: "Desconhecido",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
  }

  return (
    <span
      className={cn(
        "px-3 py-1 text-xs font-medium rounded-full inline-flex items-center",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
