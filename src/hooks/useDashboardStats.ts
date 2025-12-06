import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalVehicles: number;
  activeContracts: number;
  monthlyRevenue: number;
  delinquencyRate: number;
  growthRate: number;
  clientsTrend: { value: string; isPositive: boolean };
  vehiclesTrend: { value: string; isPositive: boolean };
  revenueTrend: { value: string; isPositive: boolean };
  contractsTrend: { value: string; isPositive: boolean };
}

export interface RecentClient {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  planName: string | null;
  status: string | null;
  createdAt: string;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export function useDashboardStats() {
  // Fetch main stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async (): Promise<DashboardStats> => {
      const now = new Date();
      const currentMonthStart = startOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = startOfMonth(now);

      // Get user's company_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) {
        throw new Error("Company not found");
      }

      const companyId = profile.company_id;

      // Fetch all stats in parallel
      const [
        clientsResult,
        lastMonthClientsResult,
        vehiclesResult,
        lastMonthVehiclesResult,
        contractsResult,
        lastMonthContractsResult,
        currentRevenueResult,
        lastMonthRevenueResult,
        overduePaymentsResult,
        totalPendingResult,
      ] = await Promise.all([
        // Current clients
        supabase
          .from("clients")
          .select("id, status", { count: "exact" })
          .eq("company_id", companyId),
        // Last month clients (created before current month)
        supabase
          .from("clients")
          .select("id", { count: "exact" })
          .eq("company_id", companyId)
          .lt("created_at", currentMonthStart.toISOString()),
        // Current vehicles
        supabase
          .from("vehicles")
          .select("id, is_active", { count: "exact" })
          .eq("company_id", companyId),
        // Last month vehicles
        supabase
          .from("vehicles")
          .select("id", { count: "exact" })
          .eq("company_id", companyId)
          .lt("created_at", currentMonthStart.toISOString()),
        // Current contracts
        supabase
          .from("contracts")
          .select("id, status", { count: "exact" })
          .eq("company_id", companyId)
          .eq("status", "active"),
        // Last month contracts
        supabase
          .from("contracts")
          .select("id", { count: "exact" })
          .eq("company_id", companyId)
          .eq("status", "active")
          .lt("created_at", currentMonthStart.toISOString()),
        // Current month revenue
        supabase
          .from("payment_transactions")
          .select("amount")
          .eq("company_id", companyId)
          .eq("status", "paid")
          .gte("paid_at", currentMonthStart.toISOString()),
        // Last month revenue
        supabase
          .from("payment_transactions")
          .select("amount")
          .eq("company_id", companyId)
          .eq("status", "paid")
          .gte("paid_at", lastMonthStart.toISOString())
          .lt("paid_at", lastMonthEnd.toISOString()),
        // Overdue payments
        supabase
          .from("payment_transactions")
          .select("id", { count: "exact" })
          .eq("company_id", companyId)
          .eq("status", "pending")
          .lt("due_date", now.toISOString().split("T")[0]),
        // Total pending payments
        supabase
          .from("payment_transactions")
          .select("id", { count: "exact" })
          .eq("company_id", companyId)
          .eq("status", "pending"),
      ]);

      // Calculate stats
      const totalClients = clientsResult.count || 0;
      const activeClients = clientsResult.data?.filter(c => c.status === "active").length || 0;
      const lastMonthClients = lastMonthClientsResult.count || 0;

      const totalVehicles = vehiclesResult.data?.filter(v => v.is_active).length || 0;
      const lastMonthVehicles = lastMonthVehiclesResult.count || 0;

      const activeContracts = contractsResult.count || 0;
      const lastMonthContracts = lastMonthContractsResult.count || 0;

      const monthlyRevenue = currentRevenueResult.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const lastMonthRevenue = lastMonthRevenueResult.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const overdueCount = overduePaymentsResult.count || 0;
      const totalPending = totalPendingResult.count || 0;
      const delinquencyRate = totalPending > 0 ? (overdueCount / totalPending) * 100 : 0;

      // Calculate trends
      const calcTrend = (current: number, previous: number) => {
        if (previous === 0) return { value: current > 0 ? "100%" : "0%", isPositive: current >= 0 };
        const change = ((current - previous) / previous) * 100;
        return {
          value: `${Math.abs(change).toFixed(1)}%`,
          isPositive: change >= 0,
        };
      };

      const clientsTrend = calcTrend(totalClients, lastMonthClients);
      const vehiclesTrend = calcTrend(totalVehicles, lastMonthVehicles);
      const revenueTrend = calcTrend(monthlyRevenue, lastMonthRevenue);
      const contractsTrend = calcTrend(activeContracts, lastMonthContracts);

      // Growth rate (clients growth over last 6 months)
      const growthRate = clientsTrend.isPositive ? parseFloat(clientsTrend.value) : -parseFloat(clientsTrend.value);

      return {
        totalClients,
        activeClients,
        totalVehicles,
        activeContracts,
        monthlyRevenue,
        delinquencyRate,
        growthRate,
        clientsTrend,
        vehiclesTrend,
        revenueTrend,
        contractsTrend,
      };
    },
  });

  // Fetch recent clients
  const { data: recentClients, isLoading: clientsLoading } = useQuery({
    queryKey: ["dashboard-recent-clients"],
    queryFn: async (): Promise<RecentClient[]> => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) return [];

      // Get recent clients
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, email, phone, status, created_at")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!clients) return [];

      // Get contracts with plans for these clients
      const clientIds = clients.map(c => c.id);
      const { data: contracts } = await supabase
        .from("contracts")
        .select("client_id, plan_id, plans(name)")
        .in("client_id", clientIds)
        .eq("status", "active");

      // Map plan names to clients
      const clientPlanMap = new Map<string, string>();
      contracts?.forEach(contract => {
        if (contract.plans && !clientPlanMap.has(contract.client_id)) {
          clientPlanMap.set(contract.client_id, (contract.plans as any).name);
        }
      });

      return clients.map(client => ({
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        planName: clientPlanMap.get(client.id) || null,
        status: client.status,
        createdAt: client.created_at,
      }));
    },
  });

  // Fetch monthly revenue for chart
  const { data: monthlyRevenue, isLoading: revenueLoading } = useQuery({
    queryKey: ["dashboard-monthly-revenue"],
    queryFn: async (): Promise<MonthlyRevenue[]> => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) return [];

      const months: MonthlyRevenue[] = [];
      const now = new Date();

      // Get last 6 months
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = startOfMonth(subMonths(monthDate, -1));

        const { data: payments } = await supabase
          .from("payment_transactions")
          .select("amount")
          .eq("company_id", profile.company_id)
          .eq("status", "paid")
          .gte("paid_at", monthStart.toISOString())
          .lt("paid_at", monthEnd.toISOString());

        const revenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

        months.push({
          month: format(monthDate, "MMM", { locale: ptBR }),
          revenue,
        });
      }

      return months;
    },
  });

  return {
    stats,
    recentClients: recentClients || [],
    monthlyRevenue: monthlyRevenue || [],
    isLoading: statsLoading || clientsLoading || revenueLoading,
  };
}
