-- Drop existing functions
DROP FUNCTION IF EXISTS encrypt_mercadopago_credential(uuid, text);
DROP FUNCTION IF EXISTS decrypt_mercadopago_credential(uuid, text);

-- Create encryption function using simple AES encryption (same method as Asaas/Inter/Gerencianet)
CREATE OR REPLACE FUNCTION encrypt_mercadopago_credential(
  p_company_id uuid,
  p_credential text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encryption_key text;
  encrypted_text TEXT;
BEGIN
  -- Get company encryption key
  SELECT encryption_key INTO v_encryption_key
  FROM companies
  WHERE id = p_company_id;
  
  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Company encryption key not found for company %', p_company_id;
  END IF;
  
  -- Encrypt using pgcrypto encrypt function (same as other integrations)
  SELECT encode(
    encrypt(p_credential::bytea, v_encryption_key::bytea, 'aes'),
    'base64'
  ) INTO encrypted_text;
  
  RETURN encrypted_text;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Encryption error: %', SQLERRM;
END;
$$;

-- Create decryption function using simple AES decryption (same method as Asaas/Inter/Gerencianet)
CREATE OR REPLACE FUNCTION decrypt_mercadopago_credential(
  p_company_id uuid,
  p_encrypted_credential text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encryption_key text;
  decrypted_text TEXT;
BEGIN
  -- Get company encryption key
  SELECT encryption_key INTO v_encryption_key
  FROM companies
  WHERE id = p_company_id;
  
  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Company encryption key not found for company %', p_company_id;
  END IF;
  
  -- Decrypt using pgcrypto decrypt function (same as other integrations)
  SELECT convert_from(
    decrypt(decode(p_encrypted_credential, 'base64'), v_encryption_key::bytea, 'aes'),
    'UTF8'
  ) INTO decrypted_text;
  
  RETURN decrypted_text;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Decryption error: %', SQLERRM;
END;
$$;