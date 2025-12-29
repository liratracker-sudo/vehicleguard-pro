-- Create table for API keys
CREATE TABLE public.company_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  permissions JSONB DEFAULT '{"read_clients": true, "read_vehicles": true, "read_payments": true, "create_charges": true}'::jsonb,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(api_key_hash)
);

-- Create table for API usage logs
CREATE TABLE public.api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.company_api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  request_params JSONB,
  response_status INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_api_keys
CREATE POLICY "Company admins can view their API keys"
ON public.company_api_keys
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.company_id = company_api_keys.company_id
));

CREATE POLICY "Company admins can insert API keys"
ON public.company_api_keys
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.company_id = company_api_keys.company_id
));

CREATE POLICY "Company admins can update their API keys"
ON public.company_api_keys
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.company_id = company_api_keys.company_id
));

CREATE POLICY "Company admins can delete their API keys"
ON public.company_api_keys
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.company_id = company_api_keys.company_id
));

-- RLS Policies for api_usage_logs
CREATE POLICY "Company admins can view their API logs"
ON public.api_usage_logs
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.company_id = api_usage_logs.company_id
));

CREATE POLICY "System can insert API logs"
ON public.api_usage_logs
FOR INSERT
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_company_api_keys_company_id ON public.company_api_keys(company_id);
CREATE INDEX idx_company_api_keys_hash ON public.company_api_keys(api_key_hash);
CREATE INDEX idx_api_usage_logs_company_id ON public.api_usage_logs(company_id);
CREATE INDEX idx_api_usage_logs_created_at ON public.api_usage_logs(created_at);

-- Trigger for updated_at
CREATE TRIGGER update_company_api_keys_updated_at
BEFORE UPDATE ON public.company_api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();