-- Adicionar campo de chave de criptografia única por empresa
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS encryption_key TEXT;

-- Gerar chaves únicas para empresas existentes que não têm
UPDATE public.companies 
SET encryption_key = encode(gen_random_bytes(32), 'base64')
WHERE encryption_key IS NULL;

-- Garantir que novas empresas sempre tenham uma chave
ALTER TABLE public.companies 
ALTER COLUMN encryption_key SET DEFAULT encode(gen_random_bytes(32), 'base64'),
ALTER COLUMN encryption_key SET NOT NULL;

-- Recriar função de criptografia para usar chave da empresa
CREATE OR REPLACE FUNCTION public.encrypt_mercadopago_credential(p_company_id UUID, p_credential TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_encryption_key TEXT;
  encrypted_text TEXT;
BEGIN
  -- Buscar chave de criptografia da empresa
  SELECT encryption_key INTO v_encryption_key
  FROM public.companies
  WHERE id = p_company_id;
  
  IF v_encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found for company';
  END IF;
  
  SELECT encode(
    encrypt(
      p_credential::bytea, 
      decode(v_encryption_key, 'base64'), 
      'aes'
    ),
    'base64'
  ) INTO encrypted_text;
  
  RETURN encrypted_text;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Encryption failed: %', SQLERRM;
END;
$$;

-- Recriar função de descriptografia para usar chave da empresa
CREATE OR REPLACE FUNCTION public.decrypt_mercadopago_credential(p_company_id UUID, p_encrypted_credential TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_encryption_key TEXT;
  decrypted_text TEXT;
BEGIN
  -- Buscar chave de criptografia da empresa
  SELECT encryption_key INTO v_encryption_key
  FROM public.companies
  WHERE id = p_company_id;
  
  IF v_encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found for company';
  END IF;
  
  SELECT convert_from(
    decrypt(
      decode(p_encrypted_credential, 'base64'), 
      decode(v_encryption_key, 'base64'), 
      'aes'
    ),
    'UTF8'
  ) INTO decrypted_text;
  
  RETURN decrypted_text;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Decryption failed: %', SQLERRM;
END;
$$;