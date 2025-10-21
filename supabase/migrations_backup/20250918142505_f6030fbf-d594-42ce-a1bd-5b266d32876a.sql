-- Fix security vulnerability: Improve public_subscription_plans view security
-- Views can't have RLS directly, but we can make the view more secure by improving its definition

-- Drop and recreate the view with better security controls
DROP VIEW IF EXISTS public.public_subscription_plans;

-- Create a more secure view that:
-- 1. Only shows active plans
-- 2. Only shows pricing to authenticated super admins
-- 3. Uses security_invoker to respect underlying table RLS policies
CREATE VIEW public.public_subscription_plans 
WITH (security_invoker = true) AS
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
    WHEN auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.role = 'super_admin'
    ) THEN price_monthly
    ELSE NULL::numeric
  END AS price_monthly,
  CASE 
    WHEN auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.role = 'super_admin'
    ) THEN price_yearly  
    ELSE NULL::numeric
  END AS price_yearly
FROM subscription_plans
WHERE 
  -- Only show active plans to regular users, all plans to super admins
  (is_active = true) OR 
  (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role = 'super_admin'
  ));

-- Ensure the underlying subscription_plans table has proper RLS for public access
-- Add a policy for public read access through the view (limited to active plans only)
DO $$
BEGIN
  -- Check if policy already exists before creating it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'subscription_plans' 
    AND policyname = 'Public can view active plans through view'
  ) THEN
    CREATE POLICY "Public can view active plans through view"
    ON public.subscription_plans
    FOR SELECT
    USING (is_active = true);
  END IF;
END $$;