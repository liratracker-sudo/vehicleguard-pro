-- Criar políticas RLS para a tabela company_branding

-- Permitir que membros da empresa vejam as configurações de branding
CREATE POLICY "Company members can view branding"
ON public.company_branding
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = company_branding.company_id
  )
);

-- Permitir que membros da empresa criem configurações de branding
CREATE POLICY "Company members can insert branding"
ON public.company_branding
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = company_branding.company_id
  )
);

-- Permitir que membros da empresa atualizem configurações de branding
CREATE POLICY "Company members can update branding"
ON public.company_branding
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = company_branding.company_id
  )
);

-- Permitir que super admins tenham acesso total
CREATE POLICY "Super admins can manage all branding"
ON public.company_branding
FOR ALL
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- Criar bucket de storage para logos das empresas se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para company-logos
CREATE POLICY "Company members can upload logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'company-logos' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.profiles
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view company logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'company-logos');

CREATE POLICY "Company members can delete their logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'company-logos' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.profiles
    WHERE user_id = auth.uid()
  )
);