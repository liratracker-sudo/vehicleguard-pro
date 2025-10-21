-- Tabela para configurações da Gerencianet/Efí Pay
CREATE TABLE IF NOT EXISTS public.gerencianet_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id_encrypted TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  is_sandbox BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  webhook_url TEXT,
  webhook_token TEXT,
  last_test_at TIMESTAMP WITH TIME ZONE,
  test_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Tabela para logs da Gerencianet
CREATE TABLE IF NOT EXISTS public.gerencianet_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  request_data JSONB,
  response_data JSONB,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gerencianet_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gerencianet_logs ENABLE ROW LEVEL SECURITY;

-- Policies para gerencianet_settings
CREATE POLICY "Users can view their company's Gerencianet settings"
  ON public.gerencianet_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = gerencianet_settings.company_id
    )
  );

CREATE POLICY "Users can create their company's Gerencianet settings"
  ON public.gerencianet_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = gerencianet_settings.company_id
    )
  );

CREATE POLICY "Users can update their company's Gerencianet settings"
  ON public.gerencianet_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = gerencianet_settings.company_id
    )
  );

-- Policies para gerencianet_logs
CREATE POLICY "Users can view their company's Gerencianet logs"
  ON public.gerencianet_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = gerencianet_logs.company_id
    )
  );

CREATE POLICY "System can insert Gerencianet logs"
  ON public.gerencianet_logs FOR INSERT
  WITH CHECK (true);

-- Funções para criptografia (usando as mesmas funções de criptografia do Asaas)
CREATE OR REPLACE FUNCTION public.encrypt_gerencianet_credential(p_credential text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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

CREATE OR REPLACE FUNCTION public.decrypt_gerencianet_credential(p_encrypted_credential text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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

-- Trigger para updated_at
CREATE TRIGGER update_gerencianet_settings_updated_at
  BEFORE UPDATE ON public.gerencianet_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();