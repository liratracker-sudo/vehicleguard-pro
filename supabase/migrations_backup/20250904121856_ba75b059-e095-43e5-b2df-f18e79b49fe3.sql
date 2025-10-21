-- Criar função para gerar perfil automaticamente quando um usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id UUID;
BEGIN
  -- Criar uma nova empresa para o usuário
  INSERT INTO public.companies (name, slug)
  VALUES 
    (COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), 
     lower(replace(COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), ' ', '-')))
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para executar a função quando um usuário é criado
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Criar perfil para usuário existente (usuário atual logado)
DO $$
DECLARE
  existing_user_id UUID;
  existing_email TEXT;
  existing_name TEXT;
  new_company_id UUID;
BEGIN
  -- Buscar usuário existente que não tem perfil
  SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
  INTO existing_user_id, existing_email, existing_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.user_id
  WHERE p.user_id IS NULL
  LIMIT 1;
  
  -- Se encontrou usuário sem perfil, criar empresa e perfil
  IF existing_user_id IS NOT NULL THEN
    -- Criar empresa
    INSERT INTO public.companies (name, slug)
    VALUES (existing_name, lower(replace(existing_name, ' ', '-')))
    RETURNING id INTO new_company_id;
    
    -- Criar perfil
    INSERT INTO public.profiles (user_id, email, full_name, company_id, role)
    VALUES (existing_user_id, existing_email, existing_name, new_company_id, 'admin');
  END IF;
END $$;