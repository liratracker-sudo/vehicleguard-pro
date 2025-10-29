-- Fix encryption/decryption using pgp_sym functions (more robust)
DROP FUNCTION IF EXISTS encrypt_mercadopago_credential(uuid, text);
DROP FUNCTION IF EXISTS decrypt_mercadopago_credential(uuid, text);

-- Create encryption function using pgp_sym_encrypt
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
  
  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Company encryption key not found for company %', p_company_id;
  END IF;
  
  -- Encrypt using pgcrypto pgp_sym_encrypt (symmetric encryption)
  v_encrypted := pgp_sym_encrypt(p_credential, v_encryption_key);
  
  -- Return as base64 encoded string
  RETURN encode(v_encrypted, 'base64');
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Encryption error: %', SQLERRM;
END;
$$;

-- Create decryption function using pgp_sym_decrypt
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
  v_decrypted text;
BEGIN
  -- Get company encryption key
  SELECT encryption_key INTO v_encryption_key
  FROM companies
  WHERE id = p_company_id;
  
  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Company encryption key not found for company %', p_company_id;
  END IF;
  
  -- Decrypt using pgcrypto pgp_sym_decrypt (symmetric decryption)
  v_decrypted := pgp_sym_decrypt(
    decode(p_encrypted_credential, 'base64'),
    v_encryption_key
  );
  
  RETURN v_decrypted;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Decryption error: %', SQLERRM;
END;
$$;