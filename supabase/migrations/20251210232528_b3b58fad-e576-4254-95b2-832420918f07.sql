-- Criar tabela de configuração de multa/juros por empresa
CREATE TABLE public.company_late_fee_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  -- Multa (aplicada uma vez após vencimento)
  fine_enabled BOOLEAN DEFAULT true,
  fine_type TEXT DEFAULT 'PERCENTAGE', -- PERCENTAGE ou FIXED
  fine_value NUMERIC(10,2) DEFAULT 2.00, -- 2% padrão
  -- Juros (aplicados por dia de atraso)
  interest_enabled BOOLEAN DEFAULT true,
  interest_type TEXT DEFAULT 'PERCENTAGE', -- PERCENTAGE ou FIXED
  interest_value NUMERIC(10,4) DEFAULT 0.033, -- 1% ao mês = ~0.033% ao dia
  -- Carência
  grace_days INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id)
);

-- Adicionar campos na tabela payment_transactions para rastrear multa/juros
ALTER TABLE public.payment_transactions 
ADD COLUMN IF NOT EXISTS original_amount NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS fine_amount NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS interest_amount NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS days_overdue INTEGER DEFAULT 0;

-- Habilitar RLS
ALTER TABLE public.company_late_fee_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their company late fee settings"
ON public.company_late_fee_settings FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.company_id = company_late_fee_settings.company_id
));

CREATE POLICY "Users can insert their company late fee settings"
ON public.company_late_fee_settings FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.company_id = company_late_fee_settings.company_id
));

CREATE POLICY "Users can update their company late fee settings"
ON public.company_late_fee_settings FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.company_id = company_late_fee_settings.company_id
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_company_late_fee_settings_updated_at
BEFORE UPDATE ON public.company_late_fee_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();