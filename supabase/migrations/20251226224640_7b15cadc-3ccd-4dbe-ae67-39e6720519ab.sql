-- Policy para Super Admins podem ver todas as subscriptions
CREATE POLICY "Super admins can view all subscriptions"
ON public.company_subscriptions
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'));

-- Policy para Super Admins podem gerenciar todas as subscriptions
CREATE POLICY "Super admins can manage all subscriptions"
ON public.company_subscriptions
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Policy para membros da empresa verem suas próprias subscriptions
CREATE POLICY "Company members can view their subscriptions"
ON public.company_subscriptions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = company_subscriptions.company_id
  )
);

-- Policy para permitir insert via service role (edge functions)
CREATE POLICY "Service role can manage subscriptions"
ON public.company_subscriptions
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');