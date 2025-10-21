-- Create table for company credentials
CREATE TABLE IF NOT EXISTS public.company_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_credentials ENABLE ROW LEVEL SECURITY;

-- Policies: super_admin can manage all; company admin can manage own
CREATE POLICY "Company credentials: super_admin or company admin can select" 
ON public.company_credentials
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND (
      p.role = 'super_admin' OR (p.role = 'admin' AND p.company_id = company_credentials.company_id)
    )
  )
);

CREATE POLICY "Company credentials: super_admin or company admin can insert" 
ON public.company_credentials
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND (
      p.role = 'super_admin' OR (p.role = 'admin' AND p.company_id = company_credentials.company_id)
    )
  )
);

CREATE POLICY "Company credentials: super_admin or company admin can update" 
ON public.company_credentials
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND (
      p.role = 'super_admin' OR (p.role = 'admin' AND p.company_id = company_credentials.company_id)
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND (
      p.role = 'super_admin' OR (p.role = 'admin' AND p.company_id = company_credentials.company_id)
    )
  )
);

CREATE POLICY "Company credentials: super_admin or company admin can delete" 
ON public.company_credentials
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND (
      p.role = 'super_admin' OR (p.role = 'admin' AND p.company_id = company_credentials.company_id)
    )
  )
);

-- Trigger to keep updated_at fresh
CREATE TRIGGER update_company_credentials_updated_at
BEFORE UPDATE ON public.company_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();