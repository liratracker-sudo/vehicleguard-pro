-- Fix security vulnerability: Enable RLS on public_subscription_plans view and create proper policies

-- Enable Row Level Security on the view
ALTER VIEW public.public_subscription_plans SET (security_invoker = true);
ALTER TABLE public.public_subscription_plans ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to view active subscription plans
-- This ensures only logged-in users can see the plans, and pricing is already filtered in the view definition
CREATE POLICY "Authenticated users can view public subscription plans"
ON public.public_subscription_plans
FOR SELECT
TO authenticated
USING (is_active = true);

-- Create policy to allow super admins to see all plans (including inactive ones)
CREATE POLICY "Super admins can view all subscription plans"
ON public.public_subscription_plans
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role = 'super_admin'
  )
);