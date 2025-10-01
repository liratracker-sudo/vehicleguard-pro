-- Tabela para configurações de IA
CREATE TABLE IF NOT EXISTS public.ai_collection_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT false,
  openai_model TEXT DEFAULT 'gpt-4o-mini',
  system_prompt TEXT DEFAULT 'Você é um assistente de cobrança profissional e educado. Gere mensagens personalizadas de cobrança considerando o histórico e situação do cliente.',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para logs de execução da IA
CREATE TABLE IF NOT EXISTS public.ai_collection_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  model_used TEXT,
  generated_message TEXT,
  sent_successfully BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para configurações de relatórios semanais
CREATE TABLE IF NOT EXISTS public.ai_weekly_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT false,
  manager_phone TEXT,
  schedule_day INTEGER DEFAULT 1, -- 1 = Monday
  schedule_time TIME DEFAULT '09:00:00',
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_collection_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_collection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_weekly_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies para ai_collection_settings
CREATE POLICY "Users can view their own company AI settings"
ON public.ai_collection_settings FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own company AI settings"
ON public.ai_collection_settings FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own company AI settings"
ON public.ai_collection_settings FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- RLS Policies para ai_collection_logs
CREATE POLICY "Users can view their own company AI logs"
ON public.ai_collection_logs FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- RLS Policies para ai_weekly_reports
CREATE POLICY "Users can view their own company AI reports settings"
ON public.ai_weekly_reports FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own company AI reports settings"
ON public.ai_weekly_reports FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own company AI reports settings"
ON public.ai_weekly_reports FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Triggers para updated_at
CREATE TRIGGER update_ai_collection_settings_updated_at
BEFORE UPDATE ON public.ai_collection_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_weekly_reports_updated_at
BEFORE UPDATE ON public.ai_weekly_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes para performance
CREATE INDEX idx_ai_collection_settings_company ON public.ai_collection_settings(company_id);
CREATE INDEX idx_ai_collection_logs_company ON public.ai_collection_logs(company_id);
CREATE INDEX idx_ai_collection_logs_payment ON public.ai_collection_logs(payment_id);
CREATE INDEX idx_ai_weekly_reports_company ON public.ai_weekly_reports(company_id);