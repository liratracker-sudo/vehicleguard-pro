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

-- Policies for company_branding
CREATE POLICY IF NOT EXISTS "Branding: admins of company or super_admin can SELECT" ON public.company_branding
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'super_admin' OR (p.company_id = company_branding.company_id AND p.role IN ('admin','super_admin'))
      )
  )
);

CREATE POLICY IF NOT EXISTS "Branding: admins of company or super_admin can UPSERT" ON public.company_branding
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'super_admin' OR (p.company_id = company_branding.company_id AND p.role IN ('admin','super_admin'))
      )
  )
);

CREATE POLICY IF NOT EXISTS "Branding: admins of company or super_admin can UPDATE" ON public.company_branding
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'super_admin' OR (p.company_id = company_branding.company_id AND p.role IN ('admin','super_admin'))
      )
  )
);

-- Policies for company_limits
CREATE POLICY IF NOT EXISTS "Limits: admins of company or super_admin can SELECT" ON public.company_limits
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'super_admin' OR (p.company_id = company_limits.company_id AND p.role IN ('admin','super_admin'))
      )
  )
);

CREATE POLICY IF NOT EXISTS "Limits: admins of company or super_admin can UPSERT" ON public.company_limits
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'super_admin' OR (p.company_id = company_limits.company_id AND p.role IN ('admin','super_admin'))
      )
  )
);

CREATE POLICY IF NOT EXISTS "Limits: admins of company or super_admin can UPDATE" ON public.company_limits
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'super_admin' OR (p.company_id = company_limits.company_id AND p.role IN ('admin','super_admin'))
      )
  )
);

-- Policies for company_activity_logs
CREATE POLICY IF NOT EXISTS "Activity: super_admin view all or company admins view own" ON public.company_activity_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'super_admin' OR (p.company_id = company_activity_logs.company_id AND p.role IN ('admin','super_admin'))
      )
  )
);

CREATE POLICY IF NOT EXISTS "Activity: system/users can insert" ON public.company_activity_logs
FOR INSERT TO authenticated
WITH CHECK (true);

-- Policies for subscription_plans
CREATE POLICY IF NOT EXISTS "Plans: anyone authenticated can SELECT active" ON public.subscription_plans
FOR SELECT TO authenticated
USING (is_active = true);

CREATE POLICY IF NOT EXISTS "Plans: super_admin can manage" ON public.subscription_plans
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin'
  )
);

-- Policies for company_subscriptions
CREATE POLICY IF NOT EXISTS "Subscriptions: super_admin view all or company admins view own" ON public.company_subscriptions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'super_admin' OR (p.company_id = company_subscriptions.company_id AND p.role IN ('admin','super_admin'))
      )
  )
);

CREATE POLICY IF NOT EXISTS "Subscriptions: super_admin or company admins can insert" ON public.company_subscriptions
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'super_admin' OR (p.company_id = company_subscriptions.company_id AND p.role IN ('admin','super_admin'))
      )
  )
);

CREATE POLICY IF NOT EXISTS "Subscriptions: super_admin or company admins can update" ON public.company_subscriptions
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'super_admin' OR (p.company_id = company_subscriptions.company_id AND p.role IN ('admin','super_admin'))
      )
  )
);

-- Extra policy for companies: allow super_admin to view and update all
CREATE POLICY IF NOT EXISTS "Companies: super_admin can view all" ON public.companies
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin')
);

CREATE POLICY IF NOT EXISTS "Companies: super_admin can update all" ON public.companies
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin')
);