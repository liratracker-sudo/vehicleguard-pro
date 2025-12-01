-- Create expense categories table
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT DEFAULT '#3b82f6',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create bank accounts table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_type TEXT DEFAULT 'checking',
  balance NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  supplier_name TEXT,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  recurrence_type TEXT,
  recurrence_parent_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  notes TEXT,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expense_categories
CREATE POLICY "Company members can view their expense categories"
  ON public.expense_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = expense_categories.company_id
    )
  );

CREATE POLICY "Company members can insert their expense categories"
  ON public.expense_categories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = expense_categories.company_id
    )
  );

CREATE POLICY "Company members can update their expense categories"
  ON public.expense_categories FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = expense_categories.company_id
    )
  );

CREATE POLICY "Company members can delete their expense categories"
  ON public.expense_categories FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = expense_categories.company_id
    )
    AND is_system = false
  );

-- RLS Policies for bank_accounts
CREATE POLICY "Company members can view their bank accounts"
  ON public.bank_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = bank_accounts.company_id
    )
  );

CREATE POLICY "Company members can insert their bank accounts"
  ON public.bank_accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = bank_accounts.company_id
    )
  );

CREATE POLICY "Company members can update their bank accounts"
  ON public.bank_accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = bank_accounts.company_id
    )
  );

CREATE POLICY "Company members can delete their bank accounts"
  ON public.bank_accounts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = bank_accounts.company_id
    )
  );

-- RLS Policies for expenses
CREATE POLICY "Company members can view their expenses"
  ON public.expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = expenses.company_id
    )
  );

CREATE POLICY "Company members can insert their expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = expenses.company_id
    )
  );

CREATE POLICY "Company members can update their expenses"
  ON public.expenses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = expenses.company_id
    )
  );

CREATE POLICY "Company members can delete their expenses"
  ON public.expenses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = expenses.company_id
    )
  );

-- Create triggers for updated_at
CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories
INSERT INTO public.expense_categories (company_id, name, icon, color, is_system)
SELECT 
  c.id,
  category.name,
  category.icon,
  category.color,
  true
FROM public.companies c
CROSS JOIN (
  VALUES
    ('Salários e Encargos', 'Users', '#ef4444'),
    ('Aluguel', 'Home', '#f97316'),
    ('Energia', 'Zap', '#eab308'),
    ('Telefone/Internet', 'Phone', '#84cc16'),
    ('Combustível', 'Fuel', '#22c55e'),
    ('Manutenção Veículos', 'Wrench', '#06b6d4'),
    ('Marketing', 'Megaphone', '#8b5cf6'),
    ('Fornecedores', 'Package', '#ec4899'),
    ('Impostos', 'FileText', '#64748b'),
    ('Outros', 'MoreHorizontal', '#94a3b8')
) AS category(name, icon, color)
ON CONFLICT DO NOTHING;