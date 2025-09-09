-- Funções para criptografar/descriptografar tokens do Asaas
CREATE OR REPLACE FUNCTION public.encrypt_asaas_token(p_token text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  encrypted_text TEXT;
BEGIN
  SELECT encode(
    encrypt(p_token::bytea, current_setting('app.encryption_key', true)::bytea, 'aes'),
    'base64'
  ) INTO encrypted_text;
  RETURN encrypted_text;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_asaas_token(p_encrypted_token text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  decrypted_text TEXT;
BEGIN
  SELECT convert_from(
    decrypt(decode(p_encrypted_token, 'base64'), current_setting('app.encryption_key', true)::bytea, 'aes'),
    'UTF8'
  ) INTO decrypted_text;
  RETURN decrypted_text;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$function$;

-- Tabela para configurações do Asaas
CREATE TABLE IF NOT EXISTS public.asaas_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  api_token_encrypted TEXT NOT NULL,
  is_sandbox BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_test_at TIMESTAMP WITH TIME ZONE,
  test_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Habilitar RLS
ALTER TABLE public.asaas_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view their company's Asaas settings" 
ON public.asaas_settings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = asaas_settings.company_id
  )
);

CREATE POLICY "Users can create their company's Asaas settings" 
ON public.asaas_settings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = asaas_settings.company_id
  )
);

CREATE POLICY "Users can update their company's Asaas settings" 
ON public.asaas_settings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = asaas_settings.company_id
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_asaas_settings_updated_at
BEFORE UPDATE ON public.asaas_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para logs de integração com Asaas
CREATE TABLE IF NOT EXISTS public.asaas_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL, -- 'test_connection', 'create_customer', 'create_charge', 'webhook'
  request_data JSONB,
  response_data JSONB,
  status TEXT NOT NULL, -- 'success', 'error'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS para logs
ALTER TABLE public.asaas_logs ENABLE ROW LEVEL SECURITY;

-- Política de RLS para logs
CREATE POLICY "Users can view their company's Asaas logs" 
ON public.asaas_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.company_id = asaas_logs.company_id
  )
);

CREATE POLICY "System can insert Asaas logs" 
ON public.asaas_logs 
FOR INSERT 
WITH CHECK (true);