-- Policies for company_branding
CREATE POLICY "Branding: super_admin or company admin can manage" ON public.company_branding
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'super_admin' OR 
        (p.company_id = company_branding.company_id AND p.role = 'admin')
      )
  )
);

-- Policies for company_limits  
CREATE POLICY "Limits: super_admin or company admin can manage" ON public.company_limits
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'super_admin' OR 
        (p.company_id = company_limits.company_id AND p.role = 'admin')
      )
  )
);

-- Policies for company_activity_logs
CREATE POLICY "Activity: super_admin view all or company admins view own" ON public.company_activity_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'super_admin' OR 
        (p.company_id = company_activity_logs.company_id AND p.role = 'admin')
      )
  )
);

CREATE POLICY "Activity: authenticated users can insert" ON public.company_activity_logs
FOR INSERT TO authenticated
WITH CHECK (true);

-- Policies for subscription_plans
CREATE POLICY "Plans: authenticated can view active plans" ON public.subscription_plans
FOR SELECT TO authenticated
USING (is_active = true);

CREATE POLICY "Plans: super_admin can manage all" ON public.subscription_plans
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'super_admin'
  )
);

-- Policies for company_subscriptions
CREATE POLICY "Subscriptions: super_admin view all or company admin view own" ON public.company_subscriptions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'super_admin' OR 
        (p.company_id = company_subscriptions.company_id AND p.role = 'admin')
      )
  )
);

CREATE POLICY "Subscriptions: super_admin or company admin can manage" ON public.company_subscriptions
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'super_admin' OR 
        (p.company_id = company_subscriptions.company_id AND p.role = 'admin')
      )
  )
);

CREATE POLICY "Subscriptions: super_admin or company admin can update" ON public.company_subscriptions
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.role = 'super_admin' OR 
        (p.company_id = company_subscriptions.company_id AND p.role = 'admin')
      )
  )
);

-- Extra policies for companies: allow super_admin to view and manage all
CREATE POLICY "Companies: super_admin can view all" ON public.companies
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin')
);

CREATE POLICY "Companies: super_admin can manage all" ON public.companies
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin')
);