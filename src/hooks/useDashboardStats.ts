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
  receivableThisMonth: number;
  receivableThisMonthCount: number;
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

async function getCompanyId(): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .single();
  return profile?.company_id || null;
}

export function useDashboardStats() {
  // Single shared company_id query
  const { data: companyId } = useQuery({
    queryKey: ["dashboard-company-id"],
    queryFn: getCompanyId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch main stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<DashboardStats> => {
      const now = new Date();
      const currentMonthStart = startOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = startOfMonth(now);
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

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
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId!)
          .eq("status", "active"),
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId!)
          .eq("status", "active")
          .lt("created_at", currentMonthStart.toISOString()),
        supabase
          .from("vehicles")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId!)
          .eq("is_active", true),
        supabase
          .from("vehicles")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId!)
          .eq("is_active", true)
          .lt("created_at", currentMonthStart.toISOString()),
        supabase
          .from("payment_transactions")
          .select("amount")
          .eq("company_id", companyId!)
          .eq("status", "paid")
          .gte("paid_at", currentMonthStart.toISOString()),
        supabase
          .from("payment_transactions")
          .select("amount")
          .eq("company_id", companyId!)
          .eq("status", "paid")
          .gte("paid_at", lastMonthStart.toISOString())
          .lt("paid_at", lastMonthEnd.toISOString()),
        supabase
          .from("payment_transactions")
          .select("amount")
          .eq("company_id", companyId!)
          .eq("status", "overdue")
          .is("protested_at", null),
        supabase
          .from("payment_transactions")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId!)
          .eq("status", "pending")
          .gte("due_date", now.toISOString().split("T")[0])
          .lte("due_date", sevenDaysFromNow.toISOString().split("T")[0])
          .is("protested_at", null),
        supabase
          .from("payment_transactions")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId!)
          .in("status", ["paid", "pending", "overdue"])
          .is("protested_at", null),
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
    queryKey: ["dashboard-recent-clients", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<RecentClient[]> => {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, email, phone, status, created_at")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!clients) return [];

      const clientIds = clients.map(c => c.id);
      const { data: contracts } = await supabase
        .from("contracts")
        .select("client_id, plan_id, plans(name)")
        .in("client_id", clientIds)
        .eq("status", "active");

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

  // Fetch monthly revenue - single query instead of 6 sequential
  const { data: monthlyRevenue, isLoading: revenueLoading } = useQuery({
    queryKey: ["dashboard-monthly-revenue", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<MonthlyRevenue[]> => {
      const now = new Date();
      const sixMonthsAgo = startOfMonth(subMonths(now, 5));

      // Single query for all 6 months
      const { data: payments } = await supabase
        .from("payment_transactions")
        .select("amount, paid_at")
        .eq("company_id", companyId!)
        .eq("status", "paid")
        .gte("paid_at", sixMonthsAgo.toISOString());

      // Group by month in JavaScript
      const monthMap = new Map<string, number>();
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const key = format(monthDate, "yyyy-MM");
        monthMap.set(key, 0);
      }

      payments?.forEach(p => {
        if (p.paid_at) {
          const key = p.paid_at.substring(0, 7); // "yyyy-MM"
          if (monthMap.has(key)) {
            monthMap.set(key, (monthMap.get(key) || 0) + Number(p.amount));
          }
        }
      });

      const months: MonthlyRevenue[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const key = format(monthDate, "yyyy-MM");
        months.push({
          month: format(monthDate, "MMM", { locale: ptBR }),
          revenue: monthMap.get(key) || 0,
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
