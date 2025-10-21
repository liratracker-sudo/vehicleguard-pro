-- Corrigir search_path na função handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
BEGIN
  -- Criar uma nova empresa para o usuário
  INSERT INTO public.companies (name, slug, is_active)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    lower(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), '[^a-zA-Z0-9]', '-', 'g')),
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