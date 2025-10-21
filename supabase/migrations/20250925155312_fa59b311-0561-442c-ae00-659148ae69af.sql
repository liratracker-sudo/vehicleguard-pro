-- Criar tabela para alertas do sistema
CREATE TABLE IF NOT EXISTS public.system_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMP WITH TIME ZONE NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Users can view alerts from their company"
ON public.system_alerts
FOR SELECT
USING (
  company_id IN (
    SELECT company_id 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "System can insert alerts"
ON public.system_alerts
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update alerts from their company"
ON public.system_alerts
FOR UPDATE
USING (
  company_id IN (
    SELECT company_id 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- Criar índices para performance
CREATE INDEX idx_system_alerts_company_type ON public.system_alerts(company_id, type);
CREATE INDEX idx_system_alerts_created_at ON public.system_alerts(created_at);
CREATE INDEX idx_system_alerts_dismissed ON public.system_alerts(dismissed_at);

-- Criar trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_system_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_system_alerts_updated_at
  BEFORE UPDATE ON public.system_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_system_alerts_updated_at();