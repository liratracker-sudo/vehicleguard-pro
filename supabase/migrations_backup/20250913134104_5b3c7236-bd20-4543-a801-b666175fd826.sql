-- Fix critical security vulnerabilities in RLS policies

-- 1. Fix public_subscription_plans view RLS
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

-- 3. Add more restrictive RLS policies for sensitive data access
-- Ensure company_credentials can only be accessed by authorized users
DROP POLICY IF EXISTS "Company credentials: super_admin or company admin can select" ON company_credentials;
CREATE POLICY "Company credentials: super_admin or company admin can select" 
ON company_credentials 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND (
      p.role = 'super_admin' 
      OR (p.role = 'admin' AND p.company_id = company_credentials.company_id)
    )
  )
);

-- 4. Strengthen payment_transactions access
DROP POLICY IF EXISTS "Company members can access payment transactions" ON payment_transactions;
CREATE POLICY "Company members can view own company transactions" 
ON payment_transactions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.company_id = payment_transactions.company_id
  )
);

CREATE POLICY "Company admins can manage own company transactions" 
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

-- 5. Strengthen clients table access
DROP POLICY IF EXISTS "Company members can access clients" ON clients;
CREATE POLICY "Company members can view own company clients" 
ON clients 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.company_id = clients.company_id
  )
);

CREATE POLICY "Company admins can manage own company clients" 
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

-- 6. Add data masking for sensitive fields in logs
CREATE OR REPLACE FUNCTION public.mask_sensitive_data(input_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Mask phone numbers and emails for privacy
  input_text := regexp_replace(input_text, '\d{10,}', '***MASKED***', 'g');
  input_text := regexp_replace(input_text, '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '***MASKED***', 'g');
  RETURN input_text;
END;
$$;