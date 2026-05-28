import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, format, startOfDay, endOfDay, differenceInDays, subDays, addDays } from "date-fns";

export interface FinancialAccount {
  id: string;
  name: string;
  bank: string;
  balance: number;
  type: string;
  transactionsCount: number;
  avgTicket: number;
  pctOfTotal: number;
}

export interface Transaction {
  id: string;
  type: "receita" | "despesa";
  description: string;
  amount: number;
  date: string;
  category: string;
  status: string;
  gateway?: string;
}

export interface MonthlyData {
  month: string;
  receita: number;
  despesa: number;
  lucro: number;
}

export interface DailyCashFlow {
  date: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

export interface ExpenseCategoryBreakdown {
  category: string;
  amount: number;
  count: number;
  pctOfTotal: number;
}

export interface GatewayTransaction {
  id: string;
  date: string;
  clientName: string;
  amount: number;
  status: string;
}

export interface CategoryExpense {
  id: string;
  date: string;
  description: string;
  amount: number;
}

export interface PeriodRange {
  from: Date;
  to: Date;
}

async function getCompanyId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("user_id", user.id)
    .single();
  if (!profile?.company_id) throw new Error("Company not found");
  return profile.company_id;
}

const GATEWAY_NAMES: Record<string, string> = {
  mercadopago: "Mercado Pago",
  asaas: "Asaas",
  inter: "Banco Inter",
  gerencianet: "Gerencianet",
  manual: "Manual / Dinheiro",
};
function getGatewayDisplayName(gateway: string): string {
  return GATEWAY_NAMES[gateway?.toLowerCase()] || gateway || "Outros";
}

export function useFinancialData(period?: PeriodRange) {
  const now = new Date();
  const defaultPeriod: PeriodRange = period ?? {
    from: startOfMonth(now),
    to: endOfMonth(now),
  };
  const from = startOfDay(defaultPeriod.from);
  const to = endOfDay(defaultPeriod.to);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  // Previous comparison range (same length, immediately before)
  const rangeDays = Math.max(1, differenceInDays(to, from) + 1);
  const prevTo = endOfDay(subDays(from, 1));
  const prevFrom = startOfDay(subDays(prevTo, rangeDays - 1));
  const prevFromIso = prevFrom.toISOString();
  const prevToIso = prevTo.toISOString();

  const sixMonthsAgo = startOfMonth(subMonths(now, 5));
  const sixMonthsAgoStr = format(sixMonthsAgo, "yyyy-MM-dd");
  const monthEndStr = format(endOfMonth(now), "yyyy-MM-dd");

  const { data: allData, isLoading } = useQuery({
    queryKey: ["financial-data-v2", fromIso, toIso],
    queryFn: async () => {
      const companyId = await getCompanyId();

      const [
        periodPayments,
        periodExpenses,
        prevPayments,
        prevExpenses,
        allPaidPayments,
        sixMonthPayments,
        sixMonthExpenses,
      ] = await Promise.all([
        // Period payments — CASH basis (paid_at)
        supabase
          .from("payment_transactions")
          .select(`id, amount, paid_at, payment_gateway, status, clients!payment_transactions_client_id_fkey(name)`)
          .eq("company_id", companyId)
          .eq("status", "paid")
          .gte("paid_at", fromIso)
          .lte("paid_at", toIso)
          .order("paid_at", { ascending: false }),

        // Period expenses — CASH basis (paid_at)
        supabase
          .from("expenses")
          .select(`id, amount, paid_at, description, status, payment_method, expense_categories(name)`)
          .eq("company_id", companyId)
          .eq("status", "paid")
          .gte("paid_at", fromIso)
          .lte("paid_at", toIso)
          .order("paid_at", { ascending: false }),

        // Previous period payments (for delta)
        supabase
          .from("payment_transactions")
          .select("amount")
          .eq("company_id", companyId)
          .eq("status", "paid")
          .gte("paid_at", prevFromIso)
          .lte("paid_at", prevToIso),

        supabase
          .from("expenses")
          .select("amount")
          .eq("company_id", companyId)
          .eq("status", "paid")
          .gte("paid_at", prevFromIso)
          .lte("paid_at", prevToIso),

        // Lifetime — used for "Saldo Total Acumulado"
        supabase
          .from("payment_transactions")
          .select("amount")
          .eq("company_id", companyId)
          .eq("status", "paid"),

        // 6 months trend — ACCRUAL (due_date)
        supabase
          .from("payment_transactions")
          .select("amount, due_date, status")
          .eq("company_id", companyId)
          .neq("status", "cancelled")
          .gte("due_date", sixMonthsAgoStr)
          .lte("due_date", monthEndStr),

        supabase
          .from("expenses")
          .select("amount, due_date, status")
          .eq("company_id", companyId)
          .neq("status", "cancelled")
          .gte("due_date", sixMonthsAgoStr)
          .lte("due_date", monthEndStr),
      ]);

      // ========== SUMMARY (current period — CASH) ==========
      const monthlyRevenue = periodPayments.data?.reduce((s, p) => s + Number(p.amount), 0) || 0;
      const monthlyExpenses = periodExpenses.data?.reduce((s, e) => s + Number(e.amount), 0) || 0;
      const totalBalance = allPaidPayments.data?.reduce((s, p) => s + Number(p.amount), 0) || 0;
      const prevRevenue = prevPayments.data?.reduce((s, p) => s + Number(p.amount), 0) || 0;
      const prevExpensesTotal = prevExpenses.data?.reduce((s, e) => s + Number(e.amount), 0) || 0;
      const txCount = periodPayments.data?.length || 0;
      const avgTicket = txCount > 0 ? monthlyRevenue / txCount : 0;

      const pct = (curr: number, prev: number) =>
        prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;

      const summary = {
        totalBalance,
        monthlyRevenue,
        monthlyExpenses,
        netProfit: monthlyRevenue - monthlyExpenses,
        avgTicket,
        txCount,
        revenueDelta: pct(monthlyRevenue, prevRevenue),
        expenseDelta: pct(monthlyExpenses, prevExpensesTotal),
        netProfitDelta: pct(monthlyRevenue - monthlyExpenses, prevRevenue - prevExpensesTotal),
      };

      // ========== ACCOUNTS BY GATEWAY (period — CASH) ==========
      const gatewayMap = new Map<string, { balance: number; transactions: number; items: GatewayTransaction[] }>();
      (periodPayments.data || []).forEach((p: any) => {
        const key = (p.payment_gateway || "outros").toLowerCase();
        const curr = gatewayMap.get(key) || { balance: 0, transactions: 0, items: [] };
        curr.balance += Number(p.amount);
        curr.transactions += 1;
        curr.items.push({
          id: p.id,
          date: p.paid_at || "",
          clientName: p.clients?.name || "Cliente",
          amount: Number(p.amount),
          status: p.status,
        });
        gatewayMap.set(key, curr);
      });

      const accountsByGateway: FinancialAccount[] = Array.from(gatewayMap.entries())
        .map(([gateway, data]) => ({
          id: gateway,
          name: getGatewayDisplayName(gateway),
          bank: getGatewayDisplayName(gateway),
          balance: data.balance,
          type: `${data.transactions} ${data.transactions === 1 ? "transação" : "transações"}`,
          transactionsCount: data.transactions,
          avgTicket: data.balance / data.transactions,
          pctOfTotal: monthlyRevenue > 0 ? (data.balance / monthlyRevenue) * 100 : 0,
        }))
        .sort((a, b) => b.balance - a.balance);

      const gatewayTransactions: Record<string, GatewayTransaction[]> = {};
      gatewayMap.forEach((data, key) => {
        gatewayTransactions[key] = data.items;
      });

      // ========== EXPENSES BY CATEGORY ==========
      const catMap = new Map<string, { amount: number; count: number; items: CategoryExpense[] }>();
      (periodExpenses.data || []).forEach((e: any) => {
        const category = e.expense_categories?.name || "Sem categoria";
        const curr = catMap.get(category) || { amount: 0, count: 0, items: [] };
        curr.amount += Number(e.amount);
        curr.count += 1;
        curr.items.push({
          id: e.id,
          date: e.paid_at || "",
          description: e.description,
          amount: Number(e.amount),
        });
        catMap.set(category, curr);
      });

      const expensesByCategory: ExpenseCategoryBreakdown[] = Array.from(catMap.entries())
        .map(([category, data]) => ({
          category,
          amount: data.amount,
          count: data.count,
          pctOfTotal: monthlyExpenses > 0 ? (data.amount / monthlyExpenses) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      const expensesByCategoryItems: Record<string, CategoryExpense[]> = {};
      catMap.forEach((data, key) => {
        expensesByCategoryItems[key] = data.items;
      });

      // ========== TRANSACTIONS (period) ==========
      const receitas: Transaction[] = (periodPayments.data || []).map((p: any) => ({
        id: p.id,
        type: "receita" as const,
        description: `Pagamento - ${p.clients?.name || "Cliente"}`,
        amount: Number(p.amount),
        date: p.paid_at || "",
        category: getGatewayDisplayName(p.payment_gateway || "outros"),
        status: p.status,
        gateway: p.payment_gateway || undefined,
      }));
      const despesas: Transaction[] = (periodExpenses.data || []).map((e: any) => ({
        id: e.id,
        type: "despesa" as const,
        description: e.description,
        amount: Number(e.amount),
        date: e.paid_at || "",
        category: e.expense_categories?.name || "Sem categoria",
        status: e.status,
      }));
      const transactions = [...receitas, ...despesas].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      // ========== MONTHLY (6 months — ACCRUAL) ==========
      const monthlyData: MonthlyData[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(now, i);
        const mStart = format(startOfMonth(date), "yyyy-MM-dd");
        const mEnd = format(endOfMonth(date), "yyyy-MM-dd");
        const monthKey = format(date, "MMM");
        const monthPayments = sixMonthPayments.data?.filter(
          (p: any) => p.due_date >= mStart && p.due_date <= mEnd && p.status === "paid"
        ) || [];
        const monthExpenses = sixMonthExpenses.data?.filter(
          (e: any) => e.due_date >= mStart && e.due_date <= mEnd && e.status === "paid"
        ) || [];
        const receita = monthPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
        const despesa = monthExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
        monthlyData.push({ month: monthKey, receita, despesa, lucro: receita - despesa });
      }

      // ========== DAILY CASH FLOW (period range) ==========
      const cashFlowData: DailyCashFlow[] = [];
      let runningBalance = 0;
      const totalDays = Math.min(rangeDays, 90); // cap at 90 days for chart sanity
      const chartFrom = totalDays === rangeDays ? from : startOfDay(subDays(to, totalDays - 1));
      for (let i = 0; i < totalDays; i++) {
        const day = addDays(chartFrom, i);
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        const dayKey = format(day, "dd/MM");
        const dayPayments = (periodPayments.data || []).filter((p: any) => {
          if (!p.paid_at) return false;
          const d = new Date(p.paid_at);
          return d >= dayStart && d <= dayEnd;
        });
        const dayExpenses = (periodExpenses.data || []).filter((e: any) => {
          if (!e.paid_at) return false;
          const d = new Date(e.paid_at);
          return d >= dayStart && d <= dayEnd;
        });
        const entradas = dayPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
        const saidas = dayExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
        runningBalance += entradas - saidas;
        cashFlowData.push({ date: dayKey, entradas, saidas, saldo: runningBalance });
      }

      return {
        summary,
        accountsByGateway,
        gatewayTransactions,
        expensesByCategory,
        expensesByCategoryItems,
        transactions,
        monthlyData,
        cashFlowData,
      };
    },
    staleTime: 1000 * 60 * 2,
  });

  return {
    summary: allData?.summary || {
      totalBalance: 0,
      monthlyRevenue: 0,
      monthlyExpenses: 0,
      netProfit: 0,
      avgTicket: 0,
      txCount: 0,
      revenueDelta: 0,
      expenseDelta: 0,
      netProfitDelta: 0,
    },
    accountsByGateway: allData?.accountsByGateway || [],
    gatewayTransactions: allData?.gatewayTransactions || {},
    expensesByCategory: allData?.expensesByCategory || [],
    expensesByCategoryItems: allData?.expensesByCategoryItems || {},
    transactions: allData?.transactions || [],
    monthlyData: allData?.monthlyData || [],
    cashFlowData: allData?.cashFlowData || [],
    isLoading,
  };
}
