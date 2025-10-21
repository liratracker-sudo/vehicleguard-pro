-- Corrigir a segurança do sistema de Super Admin
-- Apenas o email gtvflix@gmail.com pode ter role de super_admin

-- Primeiro, remover a função que permite auto-promoção
DROP FUNCTION IF EXISTS public.promote_self_to_super_admin();

-- Criar função segura que só permite super_admin para o email específico
CREATE OR REPLACE FUNCTION public.check_super_admin_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Garantir que apenas gtvflix@gmail.com tenha role de super_admin
-- Remover role de super_admin de outros usuários (se houver)
UPDATE public.profiles 
SET role = 'admin' 
WHERE role = 'super_admin' 
AND user_id NOT IN (
  SELECT id FROM auth.users WHERE email = 'gtvflix@gmail.com'
);

-- Garantir que gtvflix@gmail.com tenha role de super_admin
UPDATE public.profiles 
SET role = 'super_admin' 
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'gtvflix@gmail.com'
);

-- Criar trigger para prevenir que outros usuários se tornem super_admin
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Aplicar o trigger na tabela profiles
DROP TRIGGER IF EXISTS prevent_unauthorized_super_admin_trigger ON public.profiles;
CREATE TRIGGER prevent_unauthorized_super_admin_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unauthorized_super_admin();