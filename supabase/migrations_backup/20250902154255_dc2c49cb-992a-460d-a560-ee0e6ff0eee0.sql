-- Corrigir as funções de criptografia com search_path fixo (SEGURANÇA)
DROP FUNCTION IF EXISTS public.encrypt_whatsapp_token(TEXT);
DROP FUNCTION IF EXISTS public.decrypt_whatsapp_token(TEXT);

CREATE OR REPLACE FUNCTION public.encrypt_whatsapp_token(p_token TEXT)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
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
SET search_path = public
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

-- Corrigir a função update_updated_at_column com search_path fixo
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;