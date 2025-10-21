-- Criar tabela de configurações WhatsApp criptografadas
CREATE TABLE public.whatsapp_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  instance_url TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  api_token TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  enable_logs BOOLEAN NOT NULL DEFAULT true,
  enable_delivery_status BOOLEAN NOT NULL DEFAULT true,
  connection_status TEXT NOT NULL DEFAULT 'disconnected',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Company members can access whatsapp settings" 
ON public.whatsapp_settings 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.company_id = whatsapp_settings.company_id
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_settings_updated_at
BEFORE UPDATE ON public.whatsapp_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar função para criptografar/descriptografar dados sensíveis
CREATE OR REPLACE FUNCTION public.encrypt_whatsapp_token(p_token TEXT)
RETURNS TEXT
SECURITY DEFINER
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.decrypt_whatsapp_token(p_encrypted_token TEXT)
RETURNS TEXT
SECURITY DEFINER
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
$$ LANGUAGE plpgsql;