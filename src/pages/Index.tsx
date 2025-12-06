import { 
  Users, 
  Car, 
  DollarSign, 
  TrendingUp,
  FileText,
  AlertCircle
} from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { RecentClients } from "@/components/dashboard/RecentClients"
import { RevenueChart } from "@/components/dashboard/RevenueChart"
import { useDashboardStats } from "@/hooks/useDashboardStats"
import { Skeleton } from "@/components/ui/skeleton"

const Index = () => {
  const { stats, recentClients, monthlyRevenue, isLoading } = useDashboardStats();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const metrics = stats ? [
    {
      title: "Total de Clientes",
      value: stats.totalClients.toLocaleString('pt-BR'),
      icon: <Users className="h-4 w-4" />,
      trend: stats.clientsTrend,
      description: "Clientes cadastrados no sistema"
    },
    {
      title: "Veículos Rastreados",
      value: stats.totalVehicles.toLocaleString('pt-BR'),
      icon: <Car className="h-4 w-4" />,
      trend: stats.vehiclesTrend,
      description: "Veículos com rastreamento ativo"
    },
    {
      title: "Receita Mensal",
      value: formatCurrency(stats.monthlyRevenue),
      icon: <DollarSign className="h-4 w-4" />,
      trend: stats.revenueTrend,
      description: "Faturamento do mês atual"
    },
    {
      title: "Taxa de Crescimento",
      value: `${stats.growthRate.toFixed(1)}%`,
      icon: <TrendingUp className="h-4 w-4" />,
      trend: { value: stats.growthRate >= 0 ? `${stats.growthRate.toFixed(1)}%` : "0%", isPositive: stats.growthRate >= 0 },
      description: "Crescimento de clientes"
    },
    {
      title: "Contratos Ativos",
      value: stats.activeContracts.toLocaleString('pt-BR'),
      icon: <FileText className="h-4 w-4" />,
      trend: stats.contractsTrend,
      description: "Contratos vigentes"
    },
    {
      title: "Inadimplência",
      value: `${stats.delinquencyRate.toFixed(1)}%`,
      icon: <AlertCircle className="h-4 w-4" />,
      trend: { value: `${stats.delinquencyRate.toFixed(1)}%`, isPositive: stats.delinquencyRate <= 5 },
      description: "Taxa de inadimplência atual"
    }
  ] : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do seu negócio de rastreamento veicular
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-32 w-full" />
            ))
          ) : (
            metrics.map((metric, index) => (
              <MetricCard key={index} {...metric} />
            ))
          )}
        </div>

        {/* Charts and Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RevenueChart data={monthlyRevenue} isLoading={isLoading} />
          <RecentClients clients={recentClients} isLoading={isLoading} />
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
