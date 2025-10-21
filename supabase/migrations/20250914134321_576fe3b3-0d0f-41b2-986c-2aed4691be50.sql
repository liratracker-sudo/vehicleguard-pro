-- Fix critical security vulnerabilities - handle existing policies correctly

-- 1. Fix public_subscription_plans view RLS - recreate with security_invoker
DROP VIEW IF EXISTS public.public_subscription_plans;

-- Create a secure view that only shows plans without pricing to regular users
CREATE VIEW public.public_subscription_plans WITH (security_invoker=true) AS
SELECT 
  id,
  name,
  description,
  features,
  max_vehicles,
  max_users,
  max_messages_per_month,
  max_api_calls_per_day,
  max_storage_mb,
  is_active,
  created_at,
  updated_at,
  -- Only show pricing to super admins
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'super_admin'
    ) THEN price_monthly 
    ELSE NULL 
  END as price_monthly,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'super_admin'
    ) THEN price_yearly 
    ELSE NULL 
  END as price_yearly
FROM subscription_plans
WHERE is_active = true;

-- 2. Strengthen profiles table security to prevent unauthorized super_admin elevation
DROP TRIGGER IF EXISTS prevent_super_admin_trigger ON profiles;
CREATE TRIGGER prevent_super_admin_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_unauthorized_super_admin();

-- 3. Fix payment_transactions policies - drop and recreate with correct names
DROP POLICY IF EXISTS "Company members can access payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Company members can view own company transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Company admins can manage own company transactions" ON payment_transactions;

CREATE POLICY "Company users can view transactions" 
ON payment_transactions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.company_id = payment_transactions.company_id
  )
);

CREATE POLICY "Company admins can manage transactions" 
ON payment_transactions 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.company_id = payment_transactions.company_id
    AND p.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.company_id = payment_transactions.company_id
    AND p.role IN ('admin', 'super_admin')
  )
);

-- 4. Fix clients table policies - drop and recreate with correct names
DROP POLICY IF EXISTS "Company members can access clients" ON clients;
DROP POLICY IF EXISTS "Company members can view own company clients" ON clients;
DROP POLICY IF EXISTS "Company admins can manage own company clients" ON clients;

CREATE POLICY "Company users can view clients" 
ON clients 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.company_id = clients.company_id
  )
);

CREATE POLICY "Company admins can manage clients" 
ON clients 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.company_id = clients.company_id
    AND p.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.company_id = clients.company_id
    AND p.role IN ('admin', 'super_admin')
  )
);

-- 5. Add data masking function for sensitive information
CREATE OR REPLACE FUNCTION public.mask_sensitive_data(input_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Mask phone numbers and emails for privacy in logs
  input_text := regexp_replace(input_text, '\d{10,}', '***MASKED***', 'g');
  input_text := regexp_replace(input_text, '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '***MASKED***', 'g');
  RETURN input_text;
END;
$$;