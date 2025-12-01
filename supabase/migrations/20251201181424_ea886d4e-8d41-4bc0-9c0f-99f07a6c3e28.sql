-- Criar tabela de configurações do Assinafy
CREATE TABLE IF NOT EXISTS public.assinafy_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  api_token_encrypted TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_test_at TIMESTAMP WITH TIME ZONE,
  test_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Habilitar RLS
ALTER TABLE public.assinafy_settings ENABLE ROW LEVEL SECURITY;

-- Policy para visualizar configurações da própria empresa
CREATE POLICY "Users can view their company's Assinafy settings"
ON public.assinafy_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = assinafy_settings.company_id
  )
);

-- Policy para criar configurações
CREATE POLICY "Users can create their company's Assinafy settings"
ON public.assinafy_settings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = assinafy_settings.company_id
  )
);

-- Policy para atualizar configurações
CREATE POLICY "Users can update their company's Assinafy settings"
ON public.assinafy_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = assinafy_settings.company_id
  )
);

-- Criar funções de criptografia
CREATE OR REPLACE FUNCTION public.encrypt_assinafy_token(p_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.decrypt_assinafy_token(p_encrypted_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_assinafy_settings_company_id ON public.assinafy_settings(company_id);

-- Adicionar trigger para atualizar updated_at
CREATE TRIGGER update_assinafy_settings_updated_at
BEFORE UPDATE ON public.assinafy_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();