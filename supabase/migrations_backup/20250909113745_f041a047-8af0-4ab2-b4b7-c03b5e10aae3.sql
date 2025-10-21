-- Corrigir a função handle_new_user para gerar slugs únicos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;