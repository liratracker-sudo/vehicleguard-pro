-- Ensure pgcrypto extension is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure companies table has encryption_key column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' 
    AND column_name = 'encryption_key'
  ) THEN
    ALTER TABLE companies ADD COLUMN encryption_key TEXT;
    
    -- Generate encryption key for existing companies
    UPDATE companies 
    SET encryption_key = encode(gen_random_bytes(32), 'base64')
    WHERE encryption_key IS NULL;
  END IF;
END $$;

-- Ensure encryption_key is set for all companies
UPDATE companies 
SET encryption_key = encode(gen_random_bytes(32), 'base64')
WHERE encryption_key IS NULL OR encryption_key = '';

-- Drop and recreate encrypt function with proper pgcrypto usage
DROP FUNCTION IF EXISTS encrypt_mercadopago_credential(uuid, text);

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
  v_key_bytes bytea;
  v_encrypted bytea;
BEGIN
  -- Get company encryption key
  SELECT encryption_key INTO v_encryption_key
  FROM companies
  WHERE id = p_company_id;
  
  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Company encryption key not found for company %', p_company_id;
  END IF;
  
  -- Decode the base64 key to bytes
  v_key_bytes := decode(v_encryption_key, 'base64');
  
  -- Encrypt using pgcrypto encrypt_iv function with AES
  -- Using first 16 bytes of key as IV (initialization vector)
  v_encrypted := encrypt_iv(
    p_credential::bytea,
    v_key_bytes,
    substring(v_key_bytes from 1 for 16),
    'aes'
  );
  
  -- Return as base64 encoded string
  RETURN encode(v_encrypted, 'base64');
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Encryption error: %', SQLERRM;
END;
$$;

-- Drop and recreate decrypt function with proper pgcrypto usage
DROP FUNCTION IF EXISTS decrypt_mercadopago_credential(uuid, text);

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
  v_key_bytes bytea;
  v_decrypted bytea;
BEGIN
  -- Get company encryption key
  SELECT encryption_key INTO v_encryption_key
  FROM companies
  WHERE id = p_company_id;
  
  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Company encryption key not found for company %', p_company_id;
  END IF;
  
  -- Decode the base64 key to bytes
  v_key_bytes := decode(v_encryption_key, 'base64');
  
  -- Decrypt using pgcrypto decrypt_iv function with AES
  -- Using first 16 bytes of key as IV (initialization vector)
  v_decrypted := decrypt_iv(
    decode(p_encrypted_credential, 'base64'),
    v_key_bytes,
    substring(v_key_bytes from 1 for 16),
    'aes'
  );
  
  -- Return as text
  RETURN convert_from(v_decrypted, 'UTF8');
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Decryption error: %', SQLERRM;
END;
$$;