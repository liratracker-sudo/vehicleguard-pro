import { Users, Car, DollarSign, AlertCircle } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { FuturisticStatCard } from "@/components/ui/futuristic-stat-card"
import { RecentClients } from "@/components/dashboard/RecentClients"
import { RevenueChart } from "@/components/dashboard/RevenueChart"
import { QuickAlerts } from "@/components/dashboard/QuickAlerts"
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

  const formatTrend = (value: number, prefix: string = '') => {
    if (value === 0) return null;
    const sign = value > 0 ? '+' : '';
    return `${sign}${prefix}${value.toLocaleString('pt-BR')} este mês`;
  };

  const formatCurrencyTrend = (value: number) => {
    if (value === 0) return null;
    const sign = value > 0 ? '+' : '';
    return `${sign}${formatCurrency(value)} vs mês anterior`;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do seu negócio
          </p>
        </div>

        {/* Main Metrics - Futuristic Grid */}
        {isLoading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <FuturisticStatCard
                key={index}
                title=""
                value=""
                icon={<Users />}
                isLoading={true}
              />
            ))}
          </div>
        ) : stats && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <FuturisticStatCard
              title="Clientes Ativos"
              value={stats.activeClients.toLocaleString('pt-BR')}
              icon={<Users className="h-5 w-5" />}
              variant="default"
              trend={formatTrend(stats.clientsTrendValue) ? {
                value: formatTrend(stats.clientsTrendValue)!,
                isPositive: stats.clientsTrendValue > 0
              } : undefined}
            />
            <FuturisticStatCard
              title="Veículos"
              value={stats.totalVehicles.toLocaleString('pt-BR')}
              icon={<Car className="h-5 w-5" />}
              variant="success"
              trend={formatTrend(stats.vehiclesTrendValue) ? {
                value: formatTrend(stats.vehiclesTrendValue)!,
                isPositive: stats.vehiclesTrendValue > 0
              } : undefined}
            />
            <FuturisticStatCard
              title="Receita Mensal"
              value={formatCurrency(stats.monthlyRevenue)}
              icon={<DollarSign className="h-5 w-5" />}
              variant="success"
              trend={formatCurrencyTrend(stats.revenueTrendValue) ? {
                value: formatCurrencyTrend(stats.revenueTrendValue)!,
                isPositive: stats.revenueTrendValue > 0
              } : undefined}
            />
            <FuturisticStatCard
              title="Inadimplência"
              value={`${stats.defaultRate.toFixed(1)}%`}
              icon={<AlertCircle className="h-5 w-5" />}
              variant={stats.defaultRate > 10 ? 'danger' : stats.defaultRate > 5 ? 'warning' : 'default'}
              trend={stats.overdueCount > 0 ? {
                value: `${formatCurrency(stats.overdueAmount)} em ${stats.overdueCount} cobrança${stats.overdueCount !== 1 ? 's' : ''}`,
                isPositive: false
              } : undefined}
            />
          </div>
        )}

        {/* Quick Alerts */}
        {!isLoading && stats && (
          <QuickAlerts 
            overdueCount={stats.overdueCount}
            overdueAmount={stats.overdueAmount}
            upcomingCount={stats.upcomingCount}
            defaultRate={stats.defaultRate}
          />
        )}

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
