-- Função para definir a GUC de criptografia na sessão
CREATE OR REPLACE FUNCTION public.set_encryption_key_guc(p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM set_config('app.encryption_key', p_key, true);
END;
$$;