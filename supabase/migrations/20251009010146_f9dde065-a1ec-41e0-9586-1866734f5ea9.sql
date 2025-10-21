-- Add accent_color column to company_branding table
ALTER TABLE public.company_branding 
ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#10b981';