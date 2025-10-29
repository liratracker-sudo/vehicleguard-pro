-- Fix encrypt/decrypt functions with explicit type casts for pgcrypto

DROP FUNCTION IF EXISTS encrypt_mercadopago_credential(uuid, text);
DROP FUNCTION IF EXISTS decrypt_mercadopago_credential(uuid, text);

-- Create encryption function with proper type casting
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
  v_encrypted bytea;
BEGIN
  -- Get company encryption key
  SELECT encryption_key INTO v_encryption_key
  FROM companies
  WHERE id = p_company_id;
  
  IF v_encryption_key IS NULL THEN
    RAISE EXCEPTION 'Company encryption key not found';
  END IF;
  
  -- Encrypt using pgcrypto with AES (explicit text cast)
  v_encrypted := encrypt(
    p_credential::bytea,
    decode(v_encryption_key, 'base64'),
    'aes'::text
  );
  
  -- Return as base64 encoded string
  RETURN encode(v_encrypted, 'base64');
END;
$$;

-- Create decryption function with proper type casting
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
  v_decrypted bytea;
BEGIN
  -- Get company encryption key
  SELECT encryption_key INTO v_encryption_key
  FROM companies
  WHERE id = p_company_id;
  
  IF v_encryption_key IS NULL THEN
    RAISE EXCEPTION 'Company encryption key not found';
  END IF;
  
  -- Decrypt using pgcrypto with AES (explicit text cast)
  v_decrypted := decrypt(
    decode(p_encrypted_credential, 'base64'),
    decode(v_encryption_key, 'base64'),
    'aes'::text
  );
  
  -- Return as text
  RETURN convert_from(v_decrypted, 'UTF8');
END;
$$;