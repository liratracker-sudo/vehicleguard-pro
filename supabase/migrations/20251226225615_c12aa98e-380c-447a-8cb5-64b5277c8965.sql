-- 1. Remover as políticas existentes que causam lentidão
DROP POLICY IF EXISTS "Super admins can view all subscriptions" ON public.company_subscriptions;
DROP POLICY IF EXISTS "Super admins can manage all subscriptions" ON public.company_subscriptions;
DROP POLICY IF EXISTS "Company members can view their subscriptions" ON public.company_subscriptions;
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.company_subscriptions;

-- 2. Criar índice para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company_id 
ON public.company_subscriptions(company_id);

-- 3. Criar política única otimizada para SELECT
CREATE POLICY "Allow select subscriptions"
ON public.company_subscriptions
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin')
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = company_subscriptions.company_id
  )
);

-- 4. Criar política para operações de escrita (INSERT/UPDATE/DELETE)
CREATE POLICY "Allow manage subscriptions via service"
ON public.company_subscriptions
FOR ALL
USING (
  auth.role() = 'service_role'
  OR
  has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  auth.role() = 'service_role'
  OR
  has_role(auth.uid(), 'super_admin')
);