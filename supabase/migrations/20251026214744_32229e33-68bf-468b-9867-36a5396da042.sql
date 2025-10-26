-- Criar funções de criptografia para Mercado Pago
CREATE OR REPLACE FUNCTION public.encrypt_mercadopago_credential(p_credential text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.decrypt_mercadopago_credential(p_encrypted_credential text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Tabela de configurações do Mercado Pago
CREATE TABLE public.mercadopago_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
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

-- Enable RLS
ALTER TABLE public.mercadopago_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their company's MercadoPago settings"
ON public.mercadopago_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = mercadopago_settings.company_id
  )
);

CREATE POLICY "Users can create their company's MercadoPago settings"
ON public.mercadopago_settings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = mercadopago_settings.company_id
  )
);

CREATE POLICY "Users can update their company's MercadoPago settings"
ON public.mercadopago_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = mercadopago_settings.company_id
  )
);

-- Tabela de logs do Mercado Pago
CREATE TABLE public.mercadopago_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  status TEXT NOT NULL,
  request_data JSONB,
  response_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mercadopago_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para logs
CREATE POLICY "Users can view their company's MercadoPago logs"
ON public.mercadopago_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = mercadopago_logs.company_id
  )
);

CREATE POLICY "System can insert MercadoPago logs"
ON public.mercadopago_logs
FOR INSERT
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_mercadopago_settings_updated_at
BEFORE UPDATE ON public.mercadopago_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();