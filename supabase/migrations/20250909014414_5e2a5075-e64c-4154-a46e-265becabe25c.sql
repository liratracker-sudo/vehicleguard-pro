-- Atualizar enum de roles para incluir super_admin
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Tabela para configurações white-label por empresa
CREATE TABLE IF NOT EXISTS public.company_branding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  secondary_color TEXT DEFAULT '#f8fafc',
  favicon_url TEXT,
  subdomain TEXT UNIQUE,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_password TEXT,
  smtp_from_email TEXT,
  smtp_from_name TEXT,
  terms_of_service TEXT,
  privacy_policy TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para limites por empresa
CREATE TABLE IF NOT EXISTS public.company_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  max_vehicles INTEGER DEFAULT 100,
  max_users INTEGER DEFAULT 10,
  max_messages_per_month INTEGER DEFAULT 1000,
  max_api_calls_per_day INTEGER DEFAULT 10000,
  max_storage_mb INTEGER DEFAULT 1000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para histórico de atividades das empresas
CREATE TABLE IF NOT EXISTS public.company_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL, -- 'login', 'api_call', 'message_sent', 'vehicle_added', etc.
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para planos de assinatura
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_vehicles INTEGER DEFAULT 100,
  max_users INTEGER DEFAULT 10,
  max_messages_per_month INTEGER DEFAULT 1000,
  max_api_calls_per_day INTEGER DEFAULT 10000,
  max_storage_mb INTEGER DEFAULT 1000,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para assinaturas das empresas
CREATE TABLE IF NOT EXISTS public.company_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'suspended', 'expired'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.company_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para company_branding
CREATE POLICY "Super admins can manage all company branding" 
ON public.company_branding 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Company admins can view own branding" 
ON public.company_branding 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = company_branding.company_id
    AND profiles.role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Company admins can update own branding" 
ON public.company_branding 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = company_branding.company_id
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- Políticas RLS para company_limits
CREATE POLICY "Super admins can manage all company limits" 
ON public.company_limits 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Company admins can view own limits" 
ON public.company_limits 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = company_limits.company_id
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- Políticas RLS para company_activity_logs
CREATE POLICY "Super admins can view all activity logs" 
ON public.company_activity_logs 
FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Company admins can view own activity logs" 
ON public.company_activity_logs 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = company_activity_logs.company_id
    AND profiles.role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "System can insert activity logs" 
ON public.company_activity_logs 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Políticas RLS para subscription_plans
CREATE POLICY "Super admins can manage subscription plans" 
ON public.subscription_plans 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Anyone can view active plans" 
ON public.subscription_plans 
FOR SELECT 
TO authenticated 
USING (is_active = true);

-- Políticas RLS para company_subscriptions
CREATE POLICY "Super admins can manage all subscriptions" 
ON public.company_subscriptions 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Company admins can view own subscription" 
ON public.company_subscriptions 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = company_subscriptions.company_id
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- Triggers para updated_at
CREATE TRIGGER update_company_branding_updated_at
BEFORE UPDATE ON public.company_branding
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_limits_updated_at
BEFORE UPDATE ON public.company_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_subscriptions_updated_at
BEFORE UPDATE ON public.company_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir planos padrão
INSERT INTO public.subscription_plans (name, description, price_monthly, price_yearly, max_vehicles, max_users, max_messages_per_month, max_api_calls_per_day, max_storage_mb, features) VALUES
('Básico', 'Plano ideal para pequenas empresas', 99.90, 999.00, 50, 5, 500, 5000, 500, '["Rastreamento em tempo real", "Relatórios básicos", "WhatsApp notifications"]'),
('Profissional', 'Plano para empresas em crescimento', 199.90, 1999.00, 100, 10, 1000, 10000, 1000, '["Rastreamento em tempo real", "Relatórios avançados", "WhatsApp notifications", "API completa", "Suporte prioritário"]'),
('Empresarial', 'Plano completo para grandes empresas', 399.90, 3999.00, 500, 50, 5000, 50000, 5000, '["Rastreamento em tempo real", "Relatórios avançados", "WhatsApp notifications", "API completa", "Suporte 24/7", "White-label", "Subdomínio personalizado"]'),
('Enterprise', 'Plano ilimitado para corporações', 999.90, 9999.00, -1, -1, -1, -1, -1, '["Todos os recursos", "Implementação personalizada", "Suporte dedicado", "SLA garantido"]');

-- Habilitar realtime para as tabelas administrativas
ALTER TABLE public.company_branding REPLICA IDENTITY FULL;
ALTER TABLE public.company_limits REPLICA IDENTITY FULL;
ALTER TABLE public.company_activity_logs REPLICA IDENTITY FULL;
ALTER TABLE public.subscription_plans REPLICA IDENTITY FULL;
ALTER TABLE public.company_subscriptions REPLICA IDENTITY FULL;

-- Função para registrar atividade da empresa
CREATE OR REPLACE FUNCTION public.log_company_activity(
  p_company_id UUID,
  p_activity_type TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}',
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.company_activity_logs (
    company_id, 
    user_id, 
    activity_type, 
    description, 
    metadata
  ) VALUES (
    p_company_id, 
    COALESCE(p_user_id, auth.uid()), 
    p_activity_type, 
    p_description, 
    p_metadata
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;