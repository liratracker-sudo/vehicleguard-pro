-- Criar políticas RLS para subscription_plans

-- 1. Super admins podem gerenciar todos os planos
CREATE POLICY "Super admins can manage subscription plans"
ON public.subscription_plans
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 2. Usuários autenticados podem visualizar planos ativos
CREATE POLICY "Authenticated users can view active plans"
ON public.subscription_plans
FOR SELECT
TO authenticated
USING (is_active = true);

-- 3. Acesso público para visualizar planos ativos (checkout)
CREATE POLICY "Public can view active plans"
ON public.subscription_plans
FOR SELECT
TO anon
USING (is_active = true);