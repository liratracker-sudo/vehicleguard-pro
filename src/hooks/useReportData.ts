import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

const getCompanyId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('user_id', user.id)
    .single();
    
  return profile?.company_id;
};

export interface DREData {
  grossRevenue: number;
  netRevenue: number;
  expenses: { category: string; amount: number }[];
  totalExpenses: number;
  operatingProfit: number;
  profitMargin: number;
}

export interface CashFlowData {
  inflows: { source: string; amount: number }[];
  outflows: { category: string; amount: number }[];
  totalInflows: number;
  totalOutflows: number;
  periodBalance: number;
  accumulatedBalance: number;
}

export interface BalanceSheetData {
  assets: {
    cash: number;
    receivables: number;
    total: number;
  };
  liabilities: {
    payables: number;
    pendingExpenses: number;
    total: number;
  };
  equity: number;
}

export interface MonthlyReportData {
  currentMonth: {
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
  };
  previousMonth: {
    revenue: number;
    expenses: number;
    profit: number;
  };
  comparison: {
    revenueChange: number;
    expensesChange: number;
    profitChange: number;
  };
  topExpenses: { category: string; amount: number }[];
}

export function useReportData(selectedDate: Date) {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const prevMonthStart = startOfMonth(subMonths(selectedDate, 1));
  const prevMonthEnd = endOfMonth(subMonths(selectedDate, 1));

  return useQuery({
    queryKey: ['report-data', format(selectedDate, 'yyyy-MM')],
    queryFn: async () => {
      const companyId = await getCompanyId();
      if (!companyId) throw new Error('Company not found');

      // Current month payments (revenue) - regime de competência (due_date)
      const { data: currentPayments } = await supabase
        .from('payment_transactions')
        .select('amount, payment_gateway, status, due_date')
        .eq('company_id', companyId)
        .eq('status', 'paid')
        .gte('due_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('due_date', format(monthEnd, 'yyyy-MM-dd'));

      // Previous month payments - regime de competência (due_date)
      const { data: prevPayments } = await supabase
        .from('payment_transactions')
        .select('amount, status, due_date')
        .eq('company_id', companyId)
        .eq('status', 'paid')
        .gte('due_date', format(prevMonthStart, 'yyyy-MM-dd'))
        .lte('due_date', format(prevMonthEnd, 'yyyy-MM-dd'));

      // Current month expenses
      const { data: currentExpenses } = await supabase
        .from('expenses')
        .select(`
          amount,
          status,
          paid_at,
          due_date,
          expense_categories(name)
        `)
        .eq('company_id', companyId)
        .gte('due_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('due_date', format(monthEnd, 'yyyy-MM-dd'));

      // Previous month expenses
      const { data: prevExpenses } = await supabase
        .from('expenses')
        .select('amount, status')
        .eq('company_id', companyId)
        .eq('status', 'paid')
        .gte('due_date', format(prevMonthStart, 'yyyy-MM-dd'))
        .lte('due_date', format(prevMonthEnd, 'yyyy-MM-dd'));

      // Pending payments (receivables)
      const { data: pendingPayments } = await supabase
        .from('payment_transactions')
        .select('amount')
        .eq('company_id', companyId)
        .eq('status', 'pending');

      // Pending expenses (payables)
      const { data: pendingExpenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('company_id', companyId)
        .eq('status', 'pending');

      // All paid payments (accumulated balance)
      const { data: allPaidPayments } = await supabase
        .from('payment_transactions')
        .select('amount')
        .eq('company_id', companyId)
        .eq('status', 'paid');

      const { data: allPaidExpenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('company_id', companyId)
        .eq('status', 'paid');

      // Calculate values
      const currentRevenue = currentPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const prevRevenue = prevPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      
      const paidExpenses = currentExpenses?.filter(e => e.status === 'paid') || [];
      const currentExpenseTotal = paidExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const prevExpenseTotal = prevExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      // Group expenses by category
      const expensesByCategory: Record<string, number> = {};
      paidExpenses.forEach(e => {
        const categoryName = (e.expense_categories as any)?.name || 'Outros';
        expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + Number(e.amount);
      });

      // Group inflows by gateway
      const inflowsByGateway: Record<string, number> = {};
      currentPayments?.forEach(p => {
        const gateway = p.payment_gateway || 'manual';
        inflowsByGateway[gateway] = (inflowsByGateway[gateway] || 0) + Number(p.amount);
      });

      const totalReceivables = pendingPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const totalPayables = pendingExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const totalCash = allPaidPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const totalPaidExpenses = allPaidExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const accumulatedBalance = totalCash - totalPaidExpenses;

      const operatingProfit = currentRevenue - currentExpenseTotal;
      const profitMargin = currentRevenue > 0 ? (operatingProfit / currentRevenue) * 100 : 0;

      // DRE Data
      const dreData: DREData = {
        grossRevenue: currentRevenue,
        netRevenue: currentRevenue,
        expenses: Object.entries(expensesByCategory).map(([category, amount]) => ({ category, amount })),
        totalExpenses: currentExpenseTotal,
        operatingProfit,
        profitMargin,
      };

      // Cash Flow Data
      const cashFlowData: CashFlowData = {
        inflows: Object.entries(inflowsByGateway).map(([source, amount]) => ({ 
          source: getGatewayName(source), 
          amount 
        })),
        outflows: Object.entries(expensesByCategory).map(([category, amount]) => ({ category, amount })),
        totalInflows: currentRevenue,
        totalOutflows: currentExpenseTotal,
        periodBalance: operatingProfit,
        accumulatedBalance,
      };

      // Balance Sheet Data
      const balanceSheetData: BalanceSheetData = {
        assets: {
          cash: accumulatedBalance,
          receivables: totalReceivables,
          total: accumulatedBalance + totalReceivables,
        },
        liabilities: {
          payables: totalPayables,
          pendingExpenses: 0,
          total: totalPayables,
        },
        equity: accumulatedBalance + totalReceivables - totalPayables,
      };

      // Monthly Report Data
      const revenueChange = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;
      const expensesChange = prevExpenseTotal > 0 ? ((currentExpenseTotal - prevExpenseTotal) / prevExpenseTotal) * 100 : 0;
      const prevProfit = prevRevenue - prevExpenseTotal;
      const profitChange = prevProfit > 0 ? ((operatingProfit - prevProfit) / prevProfit) * 100 : 0;

      const monthlyReportData: MonthlyReportData = {
        currentMonth: {
          revenue: currentRevenue,
          expenses: currentExpenseTotal,
          profit: operatingProfit,
          margin: profitMargin,
        },
        previousMonth: {
          revenue: prevRevenue,
          expenses: prevExpenseTotal,
          profit: prevProfit,
        },
        comparison: {
          revenueChange,
          expensesChange,
          profitChange,
        },
        topExpenses: Object.entries(expensesByCategory)
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 3),
      };

      return {
        dre: dreData,
        cashFlow: cashFlowData,
        balanceSheet: balanceSheetData,
        monthlyReport: monthlyReportData,
      };
    },
  });
}

function getGatewayName(gateway: string): string {
  const names: Record<string, string> = {
    'asaas': 'Asaas',
    'mercadopago': 'Mercado Pago',
    'inter': 'Banco Inter',
    'gerencianet': 'Gerencianet',
    'manual': 'Manual',
  };
  return names[gateway] || gateway;
}
