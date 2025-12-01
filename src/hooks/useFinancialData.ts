import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, format, startOfDay, endOfDay } from "date-fns";

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

export function useFinancialData() {
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["financial-summary"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("Company not found");

      const now = new Date();
      const startMonth = startOfMonth(now);
      const endMonth = endOfMonth(now);

      // Receitas do mês (pagamentos confirmados)
      const { data: payments } = await supabase
        .from("payment_transactions")
        .select("amount, paid_at")
        .eq("company_id", profile.company_id)
        .eq("status", "paid")
        .gte("paid_at", startMonth.toISOString())
        .lte("paid_at", endMonth.toISOString());

      // Despesas do mês
      const { data: expenses } = await supabase
        .from("expenses")
        .select("amount, paid_at")
        .eq("company_id", profile.company_id)
        .eq("status", "paid")
        .gte("paid_at", startMonth.toISOString())
        .lte("paid_at", endMonth.toISOString());

      // Total recebido (todos os tempos)
      const { data: allPayments } = await supabase
        .from("payment_transactions")
        .select("amount")
        .eq("company_id", profile.company_id)
        .eq("status", "paid");

      const monthlyRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const monthlyExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const totalBalance = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      return {
        totalBalance,
        monthlyRevenue,
        monthlyExpenses,
        netProfit: monthlyRevenue - monthlyExpenses,
      };
    },
  });

  const { data: accountsByGateway, isLoading: loadingAccounts } = useQuery({
    queryKey: ["accounts-by-gateway"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("Company not found");

      // Buscar pagamentos agrupados por gateway
      const { data: payments } = await supabase
        .from("payment_transactions")
        .select("payment_gateway, amount, status")
        .eq("company_id", profile.company_id)
        .eq("status", "paid");

      // Agrupar por gateway
      const gatewayMap = new Map<string, { balance: number; transactions: number }>();
      
      payments?.forEach((payment) => {
        const gateway = payment.payment_gateway || "Outros";
        const current = gatewayMap.get(gateway) || { balance: 0, transactions: 0 };
        gatewayMap.set(gateway, {
          balance: current.balance + Number(payment.amount),
          transactions: current.transactions + 1,
        });
      });

      // Converter para array de contas
      const accounts: FinancialAccount[] = Array.from(gatewayMap.entries()).map(([gateway, data]) => ({
        id: gateway,
        name: gateway,
        bank: getGatewayDisplayName(gateway),
        balance: data.balance,
        type: `${data.transactions} transações`,
      }));

      return accounts;
    },
  });

  const { data: transactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ["financial-transactions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("Company not found");

      // Buscar receitas
      const { data: payments } = await supabase
        .from("payment_transactions")
        .select(`
          id,
          amount,
          paid_at,
          payment_gateway,
          status,
          clients!payment_transactions_client_id_fkey(name)
        `)
        .eq("company_id", profile.company_id)
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(50);

      // Buscar despesas
      const { data: expenses } = await supabase
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
        .eq("company_id", profile.company_id)
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(50);

      // Combinar em transações
      const receitas: Transaction[] = (payments || []).map((p) => ({
        id: p.id,
        type: "receita" as const,
        description: `Pagamento - ${p.clients?.name || "Cliente"}`,
        amount: Number(p.amount),
        date: p.paid_at || "",
        category: p.payment_gateway || "Outros",
        status: p.status,
        gateway: p.payment_gateway || undefined,
      }));

      const despesas: Transaction[] = (expenses || []).map((e) => ({
        id: e.id,
        type: "despesa" as const,
        description: e.description,
        amount: Number(e.amount),
        date: e.paid_at || "",
        category: e.expense_categories?.name || "Sem categoria",
        status: e.status,
      }));

      // Combinar e ordenar por data
      const allTransactions = [...receitas, ...despesas].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      return allTransactions;
    },
  });

  const { data: monthlyData, isLoading: loadingMonthly } = useQuery({
    queryKey: ["monthly-financial-data"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("Company not found");

      // Últimos 6 meses
      const months: MonthlyData[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);

        const { data: payments } = await supabase
          .from("payment_transactions")
          .select("amount")
          .eq("company_id", profile.company_id)
          .eq("status", "paid")
          .gte("paid_at", start.toISOString())
          .lte("paid_at", end.toISOString());

        const { data: expenses } = await supabase
          .from("expenses")
          .select("amount")
          .eq("company_id", profile.company_id)
          .eq("status", "paid")
          .gte("paid_at", start.toISOString())
          .lte("paid_at", end.toISOString());

        const receita = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
        const despesa = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

        months.push({
          month: format(date, "MMM"),
          receita,
          despesa,
          lucro: receita - despesa,
        });
      }

      return months;
    },
  });

  const { data: cashFlowData, isLoading: loadingCashFlow } = useQuery({
    queryKey: ["cash-flow-data"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("Company not found");

      // Últimos 30 dias
      const days: DailyCashFlow[] = [];
      let runningBalance = 0;

      for (let i = 29; i >= 0; i--) {
        const date = subMonths(new Date(), 0);
        date.setDate(date.getDate() - i);
        const start = startOfDay(date);
        const end = endOfDay(date);

        const { data: payments } = await supabase
          .from("payment_transactions")
          .select("amount")
          .eq("company_id", profile.company_id)
          .eq("status", "paid")
          .gte("paid_at", start.toISOString())
          .lte("paid_at", end.toISOString());

        const { data: expenses } = await supabase
          .from("expenses")
          .select("amount")
          .eq("company_id", profile.company_id)
          .eq("status", "paid")
          .gte("paid_at", start.toISOString())
          .lte("paid_at", end.toISOString());

        const entradas = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
        const saidas = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
        runningBalance += entradas - saidas;

        days.push({
          date: format(date, "dd/MM"),
          entradas,
          saidas,
          saldo: runningBalance,
        });
      }

      return days;
    },
  });

  return {
    summary: summary || { totalBalance: 0, monthlyRevenue: 0, monthlyExpenses: 0, netProfit: 0 },
    accountsByGateway: accountsByGateway || [],
    transactions: transactions || [],
    monthlyData: monthlyData || [],
    cashFlowData: cashFlowData || [],
    isLoading: loadingSummary || loadingAccounts || loadingTransactions || loadingMonthly || loadingCashFlow,
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
