-- Fix encryption functions to use pgcrypto correctly

-- Drop existing functions
DROP FUNCTION IF EXISTS encrypt_mercadopago_credential(uuid, text);
DROP FUNCTION IF EXISTS decrypt_mercadopago_credential(uuid, text);

-- Create correct encryption function using pgcrypto
CREATE OR REPLACE FUNCTION encrypt_mercadopago_credential(
  p_company_id uuid,
  p_credential text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
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
  
  -- Encrypt using pgcrypto with AES
  v_encrypted := encrypt(
    p_credential::bytea,
    v_encryption_key::bytea,
    'aes'
  );
  
  -- Return as base64 encoded string
  RETURN encode(v_encrypted, 'base64');
END;
$$;

-- Create correct decryption function using pgcrypto
CREATE OR REPLACE FUNCTION decrypt_mercadopago_credential(
  p_company_id uuid,
  p_encrypted_credential text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
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
  
  -- Decrypt using pgcrypto with AES
  v_decrypted := decrypt(
    decode(p_encrypted_credential, 'base64'),
    v_encryption_key::bytea,
    'aes'
  );
  
  -- Return as text
  RETURN convert_from(v_decrypted, 'UTF8');
END;
$$;