-- Drop and recreate encryption functions with correct pgcrypto cipher specification
DROP FUNCTION IF EXISTS encrypt_mercadopago_credential(uuid, text);
DROP FUNCTION IF EXISTS decrypt_mercadopago_credential(uuid, text);

-- Create encryption function with proper AES-CBC cipher specification
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
  encrypted_text TEXT;
BEGIN
  -- Get company encryption key
  SELECT encryption_key INTO v_encryption_key
  FROM companies
  WHERE id = p_company_id;
  
  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Company encryption key not found for company %', p_company_id;
  END IF;
  
  -- Encrypt using pgcrypto with AES-CBC cipher
  SELECT encode(
    encrypt(p_credential::bytea, v_encryption_key::bytea, 'aes-cbc/pad:pkcs'),
    'base64'
  ) INTO encrypted_text;
  
  RETURN encrypted_text;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Encryption error: %', SQLERRM;
END;
$$;

-- Create decryption function with proper AES-CBC cipher specification
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
  decrypted_text TEXT;
BEGIN
  -- Get company encryption key
  SELECT encryption_key INTO v_encryption_key
  FROM companies
  WHERE id = p_company_id;
  
  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Company encryption key not found for company %', p_company_id;
  END IF;
  
  -- Decrypt using pgcrypto with AES-CBC cipher
  SELECT convert_from(
    decrypt(decode(p_encrypted_credential, 'base64'), v_encryption_key::bytea, 'aes-cbc/pad:pkcs'),
    'UTF8'
  ) INTO decrypted_text;
  
  RETURN decrypted_text;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Decryption error: %', SQLERRM;
END;
$$;