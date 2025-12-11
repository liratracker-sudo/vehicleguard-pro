-- Habilitar extensão unaccent se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Atualizar todos os slugs existentes para usar o nome da empresa
UPDATE companies 
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      unaccent(name),
      '[^a-zA-Z0-9]+', '-', 'g'
    ),
    '^-|-$', '', 'g'
  )
)
WHERE name IS NOT NULL;

-- Atualizar a função handle_new_user para usar o nome da empresa no slug
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
  company_name TEXT;
  company_slug TEXT;
BEGIN
  -- Usar o nome completo como nome da empresa
  company_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  
  -- Gerar slug a partir do nome da empresa (não do perfil)
  company_slug := LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        unaccent(company_name),
        '[^a-zA-Z0-9]+', '-', 'g'
      ),
      '^-|-$', '', 'g'
    )
  );

  -- Criar uma nova empresa para o usuário
  INSERT INTO public.companies (name, slug, is_active)
  VALUES (
    company_name,
    company_slug,
    true
  )
  RETURNING id INTO new_company_id;

  -- Criar o perfil do usuário vinculado à empresa
  INSERT INTO public.profiles (user_id, company_id, full_name, email, role, is_active)
  VALUES (
    NEW.id,
    new_company_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    'admin',
    true
  );

  -- Criar configurações de notificação padrão para a empresa
  INSERT INTO public.payment_notification_settings (company_id)
  VALUES (new_company_id);

  RETURN NEW;
END;
$$;