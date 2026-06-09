
CREATE OR REPLACE FUNCTION public.decrypt_mercadopago_credential(p_company_id uuid, p_encrypted_credential text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_encryption_key text;
  decrypted_text TEXT;
BEGIN
  SELECT encryption_key INTO v_encryption_key FROM companies WHERE id = p_company_id;
  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Company encryption key not found for company %', p_company_id;
  END IF;
  SELECT convert_from(
    extensions.decrypt(decode(p_encrypted_credential, 'base64'), v_encryption_key::bytea, 'aes-cbc/pad:pkcs'),
    'UTF8'
  ) INTO decrypted_text;
  RETURN decrypted_text;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Decryption error: %', SQLERRM;
END;
$function$;

CREATE OR REPLACE FUNCTION public.encrypt_mercadopago_credential(p_company_id uuid, p_credential text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_encryption_key text;
  encrypted_text TEXT;
BEGIN
  SELECT encryption_key INTO v_encryption_key FROM companies WHERE id = p_company_id;
  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Company encryption key not found for company %', p_company_id;
  END IF;
  SELECT encode(
    extensions.encrypt(p_credential::bytea, v_encryption_key::bytea, 'aes-cbc/pad:pkcs'),
    'base64'
  ) INTO encrypted_text;
  RETURN encrypted_text;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Encryption error: %', SQLERRM;
END;
$function$;
