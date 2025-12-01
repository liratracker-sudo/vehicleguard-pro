import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Expense {
  id: string;
  company_id: string;
  category_id: string | null;
  bank_account_id: string | null;
  description: string;
  supplier_name: string | null;
  amount: number;
  due_date: string;
  paid_at: string | null;
  status: string;
  payment_method: string | null;
  recurrence_type: string | null;
  recurrence_parent_id: string | null;
  notes: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
  expense_categories?: {
    name: string;
    icon: string;
    color: string;
  };
  bank_accounts?: {
    name: string;
    bank_name: string;
  };
}

export interface ExpenseCategory {
  id: string;
  company_id: string;
  name: string;
  icon: string | null;
  color: string;
  is_system: boolean;
  created_at: string;
}

export interface BankAccount {
  id: string;
  company_id: string;
  name: string;
  bank_name: string;
  account_type: string;
  balance: number;
  is_active: boolean;
  created_at: string;
}

export const useExpenses = () => {
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(`
          *,
          expense_categories(name, icon, color),
          bank_accounts(name, bank_name)
        `)
        .order("due_date", { ascending: false });

      if (error) throw error;
      return data as Expense[];
    },
  });

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as ExpenseCategory[];
    },
  });

  const { data: bankAccounts = [], isLoading: loadingBankAccounts } = useQuery({
    queryKey: ["bank_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as BankAccount[];
    },
  });

  const createExpense = useMutation({
    mutationFn: async (expense: Omit<Partial<Expense>, 'company_id' | 'id'> & { description: string; amount: number; due_date: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Perfil não encontrado");

      const { data, error } = await supabase
        .from("expenses")
        .insert([{ ...expense, company_id: profile.company_id, status: 'pending' }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Despesa cadastrada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cadastrar despesa: ${error.message}`);
    },
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Expense> & { id: string }) => {
      const { data, error } = await supabase
        .from("expenses")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Despesa atualizada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar despesa: ${error.message}`);
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Despesa excluída com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir despesa: ${error.message}`);
    },
  });

  const markAsPaid = useMutation({
    mutationFn: async ({ id, bankAccountId, paymentMethod }: { id: string; bankAccountId?: string; paymentMethod?: string }) => {
      const { data, error } = await supabase
        .from("expenses")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          bank_account_id: bankAccountId || null,
          payment_method: paymentMethod || null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Despesa marcada como paga!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao marcar despesa como paga: ${error.message}`);
    },
  });

  const getSummary = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const pending = expenses.filter(e => e.status === "pending");
    const overdue = expenses.filter(e => {
      if (e.status !== "pending") return false;
      const dueDate = new Date(e.due_date);
      return dueDate < now;
    });
    const thisMonth = expenses.filter(e => {
      const date = new Date(e.due_date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const totalPending = pending.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalOverdue = overdue.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalThisMonth = thisMonth.reduce((sum, e) => sum + Number(e.amount), 0);

    return {
      pending: { count: pending.length, total: totalPending },
      overdue: { count: overdue.length, total: totalOverdue },
      thisMonth: { count: thisMonth.length, total: totalThisMonth },
    };
  };

  return {
    expenses,
    categories,
    bankAccounts,
    loadingExpenses,
    loadingCategories,
    loadingBankAccounts,
    createExpense,
    updateExpense,
    deleteExpense,
    markAsPaid,
    getSummary,
  };
};
