import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface DashboardStats {
  activeClients: number;
  totalVehicles: number;
  monthlyRevenue: number;
  overdueAmount: number;
  overdueCount: number;
  upcomingCount: number;
  clientsTrendValue: number;
  vehiclesTrendValue: number;
  revenueTrendValue: number;
  defaultRate: number;
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
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

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
        activeClientsResult,
        lastMonthClientsResult,
        vehiclesResult,
        lastMonthVehiclesResult,
        currentRevenueResult,
        lastMonthRevenueResult,
        overdueResult,
        upcomingResult,
        totalPaymentsResult,
      ] = await Promise.all([
        // Active clients
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("status", "active"),
        // Last month active clients
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("status", "active")
          .lt("created_at", currentMonthStart.toISOString()),
        // Active vehicles
        supabase
          .from("vehicles")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("is_active", true),
        // Last month vehicles
        supabase
          .from("vehicles")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("is_active", true)
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
        // Overdue payments - buscar pelo status 'overdue'
        supabase
          .from("payment_transactions")
          .select("amount")
          .eq("company_id", companyId)
          .eq("status", "overdue"),
        // Upcoming payments (next 7 days)
        supabase
          .from("payment_transactions")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("status", "pending")
          .gte("due_date", now.toISOString().split("T")[0])
          .lte("due_date", sevenDaysFromNow.toISOString().split("T")[0]),
        // Total payments for default rate calculation (inclui overdue)
        supabase
          .from("payment_transactions")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .in("status", ["paid", "pending", "overdue"]),
      ]);

      const activeClients = activeClientsResult.count || 0;
      const lastMonthClients = lastMonthClientsResult.count || 0;
      const totalVehicles = vehiclesResult.count || 0;
      const lastMonthVehicles = lastMonthVehiclesResult.count || 0;
      const monthlyRevenue = currentRevenueResult.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const lastMonthRevenue = lastMonthRevenueResult.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const overdueAmount = overdueResult.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const overdueCount = overdueResult.data?.length || 0;
      const upcomingCount = upcomingResult.count || 0;
      const totalPayments = totalPaymentsResult.count || 0;
      const defaultRate = totalPayments > 0 ? (overdueCount / totalPayments) * 100 : 0;

      return {
        activeClients,
        totalVehicles,
        monthlyRevenue,
        overdueAmount,
        overdueCount,
        upcomingCount,
        clientsTrendValue: activeClients - lastMonthClients,
        vehiclesTrendValue: totalVehicles - lastMonthVehicles,
        revenueTrendValue: monthlyRevenue - lastMonthRevenue,
        defaultRate,
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
