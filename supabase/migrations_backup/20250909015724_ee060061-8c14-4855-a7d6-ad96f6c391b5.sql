-- Fix profiles.role check constraint to allow 'super_admin'
BEGIN;

-- Drop old constraint if it exists
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Recreate constraint including the new role value
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin', 'super_admin'));

COMMIT;