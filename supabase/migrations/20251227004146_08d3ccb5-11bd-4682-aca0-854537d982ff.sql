-- Criar tabela para cache dos scores de clientes
CREATE TABLE public.client_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 100 CHECK (score >= 0 AND score <= 100),
  total_payments INTEGER DEFAULT 0,
  paid_on_time INTEGER DEFAULT 0,
  paid_late INTEGER DEFAULT 0,
  overdue_count INTEGER DEFAULT 0,
  avg_days_late NUMERIC(5,2) DEFAULT 0,
  max_days_late INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id)
);

-- Índices para performance
CREATE INDEX idx_client_scores_company_id ON public.client_scores(company_id);
CREATE INDEX idx_client_scores_score ON public.client_scores(score);

-- Habilitar RLS
ALTER TABLE public.client_scores ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Company members can view client scores"
ON public.client_scores FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.company_id = client_scores.company_id
));

CREATE POLICY "Company members can insert client scores"
ON public.client_scores FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.company_id = client_scores.company_id
));

CREATE POLICY "Company members can update client scores"
ON public.client_scores FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.company_id = client_scores.company_id
));

CREATE POLICY "Company members can delete client scores"
ON public.client_scores FOR DELETE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.company_id = client_scores.company_id
));

-- Trigger para updated_at
CREATE TRIGGER update_client_scores_updated_at
BEFORE UPDATE ON public.client_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();