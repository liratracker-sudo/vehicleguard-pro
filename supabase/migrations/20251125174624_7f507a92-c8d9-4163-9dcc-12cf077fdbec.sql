-- Add theme_mode column to company_branding table
ALTER TABLE public.company_branding
ADD COLUMN IF NOT EXISTS theme_mode text DEFAULT 'dark';

COMMENT ON COLUMN public.company_branding.theme_mode IS 'Theme mode for the company: dark or light';