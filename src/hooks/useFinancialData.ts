import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, format, startOfDay, endOfDay, subDays } from "date-fns";

export interface FinancialAccount {
  id: string;
  name: string;
  bank: string;
  balance: number;
  type: string;
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

// Helper para obter company_id - evita repetição de queries de autenticação
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

export function useFinancialData() {
  // Query única que busca todos os dados de uma vez
  const { data: allData, isLoading } = useQuery({
    queryKey: ["financial-data-optimized"],
    queryFn: async () => {
      const companyId = await getCompanyId();
      const now = new Date();
      
      // Definir ranges de data
      const currentMonthStart = startOfMonth(now);
      const currentMonthEnd = endOfMonth(now);
      const sixMonthsAgo = startOfMonth(subMonths(now, 5));
      const thirtyDaysAgo = startOfDay(subDays(now, 29));

      // Formato de data para due_date (campo date, não timestamp)
      const currentMonthStartStr = format(currentMonthStart, 'yyyy-MM-dd');
      const currentMonthEndStr = format(currentMonthEnd, 'yyyy-MM-dd');
      const sixMonthsAgoStr = format(sixMonthsAgo, 'yyyy-MM-dd');
      const currentMonthEndStr6 = format(currentMonthEnd, 'yyyy-MM-dd');

      // Executar TODAS as queries em paralelo
      const [
        // Summary data - regime de competência (due_date) para receita/despesa mensal
        currentMonthPayments,
        currentMonthExpenses,
        allPaidPayments,
        // Transactions
        recentPayments,
        recentExpenses,
        // Monthly data (6 meses) - regime de competência
        sixMonthPayments,
        sixMonthExpenses,
        // Cash flow (30 dias) - regime de caixa (paid_at)
        thirtyDaysPayments,
        thirtyDaysExpenses,
      ] = await Promise.all([
        // Current month payments - por competência (due_date) + status paid
        supabase
          .from("payment_transactions")
          .select("amount, due_date")
          .eq("company_id", companyId)
          .eq("status", "paid")
          .gte("due_date", currentMonthStartStr)
          .lte("due_date", currentMonthEndStr),
        
        // Current month expenses - por competência (due_date) + status paid
        supabase
          .from("expenses")
          .select("amount, due_date")
          .eq("company_id", companyId)
          .eq("status", "paid")
          .gte("due_date", currentMonthStartStr)
          .lte("due_date", currentMonthEndStr),
        
        // All paid payments (for total balance - regime de caixa)
        supabase
          .from("payment_transactions")
          .select("amount, payment_gateway, status")
          .eq("company_id", companyId)
          .eq("status", "paid"),
        
        // Recent payments for transactions
        supabase
          .from("payment_transactions")
          .select(`
            id,
            amount,
            paid_at,
            payment_gateway,
            status,
            clients!payment_transactions_client_id_fkey(name)
          `)
          .eq("company_id", companyId)
          .eq("status", "paid")
          .order("paid_at", { ascending: false })
          .limit(50),
        
        // Recent expenses for transactions
        supabase
          .from("expenses")
          .select(`
            id,
            amount,
            paid_at,
            description,
            status,
            payment_method,
            expense_categories(name)
          `)
          .eq("company_id", companyId)
          .eq("status", "paid")
          .order("paid_at", { ascending: false })
          .limit(50),
        
        // 6 months payments - regime de competência (due_date)
        supabase
          .from("payment_transactions")
          .select("amount, due_date, status")
          .eq("company_id", companyId)
          .neq("status", "cancelled")
          .gte("due_date", sixMonthsAgoStr)
          .lte("due_date", currentMonthEndStr6),
        
        // 6 months expenses - regime de competência (due_date)
        supabase
          .from("expenses")
          .select("amount, due_date, status")
          .eq("company_id", companyId)
          .neq("status", "cancelled")
          .gte("due_date", sixMonthsAgoStr)
          .lte("due_date", currentMonthEndStr6),
        
        // 30 days payments - regime de caixa (paid_at) para fluxo diário
        supabase
          .from("payment_transactions")
          .select("amount, paid_at")
          .eq("company_id", companyId)
          .eq("status", "paid")
          .gte("paid_at", thirtyDaysAgo.toISOString()),
        
        // 30 days expenses - regime de caixa (paid_at) para fluxo diário
        supabase
          .from("expenses")
          .select("amount, paid_at")
          .eq("company_id", companyId)
          .eq("status", "paid")
          .gte("paid_at", thirtyDaysAgo.toISOString()),
      ]);

      // ========== PROCESSAR SUMMARY ==========
      const monthlyRevenue = currentMonthPayments.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const monthlyExpenses = currentMonthExpenses.data?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const totalBalance = allPaidPayments.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const summary = {
        totalBalance,
        monthlyRevenue,
        monthlyExpenses,
        netProfit: monthlyRevenue - monthlyExpenses,
      };

      // ========== PROCESSAR ACCOUNTS BY GATEWAY ==========
      const gatewayMap = new Map<string, { balance: number; transactions: number }>();
      allPaidPayments.data?.forEach((payment) => {
        const gateway = payment.payment_gateway || "Outros";
        const current = gatewayMap.get(gateway) || { balance: 0, transactions: 0 };
        gatewayMap.set(gateway, {
          balance: current.balance + Number(payment.amount),
          transactions: current.transactions + 1,
        });
      });

      const accountsByGateway: FinancialAccount[] = Array.from(gatewayMap.entries()).map(([gateway, data]) => ({
        id: gateway,
        name: gateway,
        bank: getGatewayDisplayName(gateway),
        balance: data.balance,
        type: `${data.transactions} transações`,
      }));

      // ========== PROCESSAR TRANSACTIONS ==========
      const receitas: Transaction[] = (recentPayments.data || []).map((p) => ({
        id: p.id,
        type: "receita" as const,
        description: `Pagamento - ${p.clients?.name || "Cliente"}`,
        amount: Number(p.amount),
        date: p.paid_at || "",
        category: p.payment_gateway || "Outros",
        status: p.status,
        gateway: p.payment_gateway || undefined,
      }));

      const despesas: Transaction[] = (recentExpenses.data || []).map((e) => ({
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

      // ========== PROCESSAR MONTHLY DATA - regime de competência (due_date) ==========
      const monthlyData: MonthlyData[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(now, i);
        const mStart = format(startOfMonth(date), 'yyyy-MM-dd');
        const mEnd = format(endOfMonth(date), 'yyyy-MM-dd');
        const monthKey = format(date, "MMM");

        const monthPayments = sixMonthPayments.data?.filter((p) => {
          return p.due_date >= mStart && p.due_date <= mEnd && p.status === 'paid';
        }) || [];

        const monthExpenses = sixMonthExpenses.data?.filter((e) => {
          return e.due_date >= mStart && e.due_date <= mEnd && e.status === 'paid';
        }) || [];

        const receita = monthPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const despesa = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

        monthlyData.push({
          month: monthKey,
          receita,
          despesa,
          lucro: receita - despesa,
        });
      }

      // ========== PROCESSAR CASH FLOW DATA (agrupamento em JS) ==========
      const cashFlowData: DailyCashFlow[] = [];
      let runningBalance = 0;

      for (let i = 29; i >= 0; i--) {
        const date = subDays(now, i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);
        const dayKey = format(date, "dd/MM");

        const dayPayments = thirtyDaysPayments.data?.filter((p) => {
          const paidAt = new Date(p.paid_at!);
          return paidAt >= dayStart && paidAt <= dayEnd;
        }) || [];

        const dayExpenses = thirtyDaysExpenses.data?.filter((e) => {
          const paidAt = new Date(e.paid_at!);
          return paidAt >= dayStart && paidAt <= dayEnd;
        }) || [];

        const entradas = dayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const saidas = dayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
        runningBalance += entradas - saidas;

        cashFlowData.push({
          date: dayKey,
          entradas,
          saidas,
          saldo: runningBalance,
        });
      }

      return {
        summary,
        accountsByGateway,
        transactions,
        monthlyData,
        cashFlowData,
      };
    },
    staleTime: 1000 * 60 * 2, // Cache por 2 minutos
  });

  return {
    summary: allData?.summary || { totalBalance: 0, monthlyRevenue: 0, monthlyExpenses: 0, netProfit: 0 },
    accountsByGateway: allData?.accountsByGateway || [],
    transactions: allData?.transactions || [],
    monthlyData: allData?.monthlyData || [],
    cashFlowData: allData?.cashFlowData || [],
    isLoading,
  };
}

function getGatewayDisplayName(gateway: string): string {
  const names: Record<string, string> = {
    mercadopago: "Mercado Pago",
    asaas: "Asaas",
    inter: "Banco Inter",
    gerencianet: "Gerencianet",
  };
  return names[gateway.toLowerCase()] || gateway;
}
