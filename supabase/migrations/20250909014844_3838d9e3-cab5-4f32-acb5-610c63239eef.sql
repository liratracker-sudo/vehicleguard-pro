-- Inserir planos padrão
INSERT INTO public.subscription_plans (name, description, price_monthly, price_yearly, max_vehicles, max_users, max_messages_per_month, max_api_calls_per_day, max_storage_mb, features) VALUES
('Básico', 'Plano ideal para pequenas empresas', 99.90, 999.00, 50, 5, 500, 5000, 500, '["Rastreamento em tempo real", "Relatórios básicos", "WhatsApp notifications"]'),
('Profissional', 'Plano para empresas em crescimento', 199.90, 1999.00, 100, 10, 1000, 10000, 1000, '["Rastreamento em tempo real", "Relatórios avançados", "WhatsApp notifications", "API completa", "Suporte prioritário"]'),
('Empresarial', 'Plano completo para grandes empresas', 399.90, 3999.00, 500, 50, 5000, 50000, 5000, '["Rastreamento em tempo real", "Relatórios avançados", "WhatsApp notifications", "API completa", "Suporte 24/7", "White-label", "Subdomínio personalizado"]'),
('Enterprise', 'Plano ilimitado para corporações', 999.90, 9999.00, -1, -1, -1, -1, -1, '["Todos os recursos", "Implementação personalizada", "Suporte dedicado", "SLA garantido"]');

-- Função para promover usuário atual a super_admin se ainda não existir nenhum
CREATE OR REPLACE FUNCTION public.promote_self_to_super_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'super_admin') THEN
    UPDATE public.profiles
    SET role = 'super_admin'
    WHERE user_id = auth.uid();
  END IF;
END;
$$;

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