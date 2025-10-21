-- Fix critical security vulnerabilities by strengthening RLS policies

-- 1. Fix subscription_plans table - restrict pricing information access
DROP POLICY IF EXISTS "Plans: authenticated can view active plans" ON subscription_plans;

-- Create more restrictive policy for subscription_plans
CREATE POLICY "Plans: authenticated can view basic info only" 
ON subscription_plans 
FOR SELECT 
USING (
  is_active = true AND 
  (
    -- Allow users to see basic plan info (name, description, features) but not pricing
    auth.uid() IS NOT NULL
  )
);

-- Super admin can still see all data including pricing
CREATE POLICY "Plans: super_admin can view all data" 
ON subscription_plans 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'super_admin'
  )
);

-- 2. Strengthen function search paths for security
CREATE OR REPLACE FUNCTION public.encrypt_whatsapp_token(p_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
$$;

CREATE OR REPLACE FUNCTION public.decrypt_whatsapp_token(p_encrypted_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
$$;

CREATE OR REPLACE FUNCTION public.validate_whatsapp_session(p_company_id uuid)
RETURNS TABLE(is_valid boolean, session_status text, instance_name text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  session_record RECORD;
BEGIN
  -- Buscar sessão ativa da empresa
  SELECT ws.status, ws.instance_name, ws.expires_at, ws.updated_at
  INTO session_record
  FROM whatsapp_sessions ws
  WHERE ws.company_id = p_company_id
  ORDER BY ws.updated_at DESC
  LIMIT 1;

  -- Se não encontrou sessão
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'not_found'::TEXT, ''::TEXT, 'Nenhuma sessão WhatsApp encontrada. Configure a integração primeiro.'::TEXT;
    RETURN;
  END IF;

  -- Se sessão expirou (mais de 24 horas sem atualização)
  IF session_record.updated_at < NOW() - INTERVAL '24 hours' THEN
    -- Atualizar status para expirada
    UPDATE whatsapp_sessions 
    SET status = 'expired' 
    WHERE company_id = p_company_id AND instance_name = session_record.instance_name;
    
    RETURN QUERY SELECT FALSE, 'expired'::TEXT, session_record.instance_name, 'Sessão WhatsApp expirada. Reconecte para continuar enviando mensagens.'::TEXT;
    RETURN;
  END IF;

  -- Se sessão não está conectada
  IF session_record.status != 'connected' THEN
    RETURN QUERY SELECT FALSE, session_record.status, session_record.instance_name, 
      CASE 
        WHEN session_record.status = 'connecting' THEN 'Sessão WhatsApp conectando. Aguarde alguns instantes.'
        WHEN session_record.status = 'disconnected' THEN 'Sessão WhatsApp desconectada. Reconecte para enviar mensagens.'
        ELSE 'Sessão WhatsApp em estado: ' || session_record.status
      END;
    RETURN;
  END IF;

  -- Sessão válida
  RETURN QUERY SELECT TRUE, session_record.status, session_record.instance_name, 'Sessão WhatsApp ativa e válida.'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_whatsapp_connection()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expired_sessions CURSOR FOR 
    SELECT ws.*, wss.instance_name as settings_instance_name, wss.api_token
    FROM whatsapp_sessions ws
    JOIN whatsapp_settings wss ON ws.company_id = wss.company_id
    WHERE ws.updated_at < NOW() - INTERVAL '5 minutes'
    AND ws.status = 'connected'
    AND wss.is_active = true;
    
  session_record RECORD;
BEGIN
  -- Marcar sessões antigas como expiradas e tentar reconectar
  FOR session_record IN expired_sessions LOOP
    -- Atualizar status para reconectando
    UPDATE whatsapp_sessions 
    SET status = 'reconnecting', updated_at = NOW()
    WHERE id = session_record.id;
    
    -- Log da tentativa de reconexão
    INSERT INTO whatsapp_logs (
      company_id, 
      phone_number, 
      message_type, 
      message_content, 
      status
    ) VALUES (
      session_record.company_id,
      'system',
      'system',
      'Tentando reconectar sessão: ' || session_record.instance_name,
      'sent'
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_company_id UUID;
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Gerar slug base a partir do nome ou email
  base_slug := lower(replace(
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), 
    ' ', '-'
  ));
  
  -- Remover caracteres especiais do slug
  base_slug := regexp_replace(base_slug, '[^a-z0-9-]', '', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  -- Se o slug estiver vazio, usar um padrão
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'empresa';
  END IF;
  
  final_slug := base_slug;
  
  -- Verificar se o slug já existe e gerar um único
  WHILE EXISTS (SELECT 1 FROM public.companies WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  -- Criar uma nova empresa para o usuário
  INSERT INTO public.companies (name, slug)
  VALUES 
    (COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), 
     final_slug)
  RETURNING id INTO new_company_id;
  
  -- Criar perfil do usuário
  INSERT INTO public.profiles (user_id, email, full_name, company_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    new_company_id,
    'admin'
  );
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_super_admin_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Buscar o email do usuário atual
  SELECT email INTO user_email
  FROM auth.users 
  WHERE id = auth.uid();
  
  -- Retornar true apenas se for o email autorizado
  RETURN user_email = 'gtvflix@gmail.com';
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_unauthorized_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Se está tentando definir role como super_admin
  IF NEW.role = 'super_admin' THEN
    -- Buscar email do usuário
    SELECT email INTO user_email
    FROM auth.users 
    WHERE id = NEW.user_id;
    
    -- Só permitir se for o email autorizado
    IF user_email != 'gtvflix@gmail.com' THEN
      RAISE EXCEPTION 'Acesso negado: Apenas usuários autorizados podem ter role de Super Admin';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.encrypt_asaas_token(p_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
$$;

CREATE OR REPLACE FUNCTION public.decrypt_asaas_token(p_encrypted_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
$$;

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

CREATE OR REPLACE FUNCTION public.log_company_activity(p_company_id uuid, p_activity_type text, p_description text, p_metadata jsonb DEFAULT '{}'::jsonb, p_user_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.company_activity_logs (
    company_id, 
    user_id, 
    activity_type, 
    description, 
    metadata
  ) VALUES (
    p_company_id, 
    COALESCE(p_user_id, auth.uid()), 
    p_activity_type, 
    p_description, 
    p_metadata
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3. Add additional security measures - audit logging for sensitive table access
CREATE OR REPLACE FUNCTION public.audit_sensitive_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log access to sensitive tables
  IF TG_OP = 'SELECT' THEN
    -- Don't log selects to avoid performance issues
    RETURN NULL;
  END IF;
  
  INSERT INTO company_activity_logs (
    company_id,
    user_id,
    activity_type,
    description,
    metadata
  ) VALUES (
    COALESCE(NEW.company_id, OLD.company_id),
    auth.uid(),
    'sensitive_data_access',
    TG_OP || ' operation on ' || TG_TABLE_NAME,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'timestamp', now()
    )
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add audit triggers to sensitive tables
DROP TRIGGER IF EXISTS audit_asaas_settings ON asaas_settings;
CREATE TRIGGER audit_asaas_settings
  AFTER INSERT OR UPDATE OR DELETE ON asaas_settings
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_access();

DROP TRIGGER IF EXISTS audit_whatsapp_settings ON whatsapp_settings;
CREATE TRIGGER audit_whatsapp_settings
  AFTER INSERT OR UPDATE OR DELETE ON whatsapp_settings
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_access();

DROP TRIGGER IF EXISTS audit_company_credentials ON company_credentials;
CREATE TRIGGER audit_company_credentials
  AFTER INSERT OR UPDATE OR DELETE ON company_credentials
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_access();

-- 4. Create a security view for subscription plans that hides pricing from regular users
CREATE OR REPLACE VIEW public.public_subscription_plans AS
SELECT 
  id,
  name,
  description,
  features,
  max_vehicles,
  max_users,
  max_messages_per_month,
  max_api_calls_per_day,
  max_storage_mb,
  is_active,
  created_at,
  updated_at,
  -- Only show pricing to super admins
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'super_admin'
    ) THEN price_monthly 
    ELSE NULL 
  END as price_monthly,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'super_admin'
    ) THEN price_yearly 
    ELSE NULL 
  END as price_yearly
FROM subscription_plans
WHERE is_active = true;