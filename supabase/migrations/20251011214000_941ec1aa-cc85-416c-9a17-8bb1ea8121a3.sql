-- Create Inter settings table
CREATE TABLE IF NOT EXISTS public.inter_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id_encrypted TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  certificate_base64 TEXT,
  is_sandbox BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  webhook_url TEXT,
  webhook_enabled BOOLEAN DEFAULT false,
  last_test_at TIMESTAMP WITH TIME ZONE,
  test_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Create Inter logs table
CREATE TABLE IF NOT EXISTS public.inter_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  status TEXT NOT NULL,
  request_data JSONB,
  response_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inter_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inter_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inter_settings
CREATE POLICY "Users can view their company's Inter settings"
  ON public.inter_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = inter_settings.company_id
    )
  );

CREATE POLICY "Users can create their company's Inter settings"
  ON public.inter_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = inter_settings.company_id
    )
  );

CREATE POLICY "Users can update their company's Inter settings"
  ON public.inter_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = inter_settings.company_id
    )
  );

-- RLS Policies for inter_logs
CREATE POLICY "Users can view their company's Inter logs"
  ON public.inter_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = inter_logs.company_id
    )
  );

CREATE POLICY "System can insert Inter logs"
  ON public.inter_logs FOR INSERT
  WITH CHECK (true);

-- Encryption functions for Inter credentials
CREATE OR REPLACE FUNCTION public.encrypt_inter_credential(p_credential TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  encrypted_text TEXT;
BEGIN
  SELECT encode(
    encrypt(p_credential::bytea, current_setting('app.encryption_key', true)::bytea, 'aes'),
    'base64'
  ) INTO encrypted_text;
  RETURN encrypted_text;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_inter_credential(p_encrypted_credential TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  decrypted_text TEXT;
BEGIN
  SELECT convert_from(
    decrypt(decode(p_encrypted_credential, 'base64'), current_setting('app.encryption_key', true)::bytea, 'aes'),
    'UTF8'
  ) INTO decrypted_text;
  RETURN decrypted_text;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_inter_settings_updated_at
  BEFORE UPDATE ON public.inter_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();