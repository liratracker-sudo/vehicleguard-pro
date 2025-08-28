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

const Index = () => {
  const metrics = [
    {
      title: "Total de Clientes",
      value: "1,234",
      icon: <Users className="h-4 w-4" />,
      trend: { value: "12%", isPositive: true },
      description: "Clientes ativos no sistema"
    },
    {
      title: "Veículos Rastreados",
      value: "2,847",
      icon: <Car className="h-4 w-4" />,
      trend: { value: "8%", isPositive: true },
      description: "Veículos com rastreamento ativo"
    },
    {
      title: "Receita Mensal",
      value: "R$ 67.890",
      icon: <DollarSign className="h-4 w-4" />,
      trend: { value: "15%", isPositive: true },
      description: "Faturamento do mês atual"
    },
    {
      title: "Taxa de Crescimento",
      value: "23.5%",
      icon: <TrendingUp className="h-4 w-4" />,
      trend: { value: "2.3%", isPositive: true },
      description: "Crescimento nos últimos 6 meses"
    },
    {
      title: "Contratos Ativos",
      value: "1,156",
      icon: <FileText className="h-4 w-4" />,
      trend: { value: "9%", isPositive: true },
      description: "Contratos vigentes"
    },
    {
      title: "Inadimplência",
      value: "3.2%",
      icon: <AlertCircle className="h-4 w-4" />,
      trend: { value: "1.1%", isPositive: false },
      description: "Taxa de inadimplência atual"
    }
  ]

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
          {metrics.map((metric, index) => (
            <MetricCard key={index} {...metric} />
          ))}
        </div>

        {/* Charts and Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RevenueChart />
          <RecentClients />
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
