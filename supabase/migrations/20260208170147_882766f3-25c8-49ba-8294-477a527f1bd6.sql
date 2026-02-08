-- Criar tabela de vendedores/representantes
CREATE TABLE public.sellers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  phone text,
  email text,
  commission_rate numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  registrations_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Índices para sellers
CREATE INDEX idx_sellers_company_id ON public.sellers(company_id);
CREATE INDEX idx_sellers_code ON public.sellers(code);
CREATE INDEX idx_sellers_is_active ON public.sellers(is_active);

-- Habilitar RLS
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para sellers
CREATE POLICY "Company members can view their sellers"
  ON public.sellers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = sellers.company_id
  ));

CREATE POLICY "Company members can insert sellers"
  ON public.sellers FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = sellers.company_id
  ));

CREATE POLICY "Company members can update their sellers"
  ON public.sellers FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = sellers.company_id
  ));

CREATE POLICY "Company members can delete their sellers"
  ON public.sellers FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = sellers.company_id
  ));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_sellers_updated_at
  BEFORE UPDATE ON public.sellers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar campos de rastreamento em client_registrations
ALTER TABLE public.client_registrations
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referral_name text,
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_by_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS how_did_you_hear text;

-- Índices para os novos campos
CREATE INDEX IF NOT EXISTS idx_client_registrations_referral_source ON public.client_registrations(referral_source);
CREATE INDEX IF NOT EXISTS idx_client_registrations_seller_id ON public.client_registrations(seller_id);
CREATE INDEX IF NOT EXISTS idx_client_registrations_utm_source ON public.client_registrations(utm_source);

-- Função para incrementar contador de cadastros do vendedor
CREATE OR REPLACE FUNCTION public.increment_seller_registrations()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.seller_id IS NOT NULL THEN
    UPDATE public.sellers
    SET registrations_count = registrations_count + 1
    WHERE id = NEW.seller_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para incrementar contador quando cadastro é criado com seller_id
CREATE TRIGGER increment_seller_registrations_trigger
  AFTER INSERT ON public.client_registrations
  FOR EACH ROW
  WHEN (NEW.seller_id IS NOT NULL)
  EXECUTE FUNCTION public.increment_seller_registrations();

-- Política para permitir leitura pública de sellers (para validação no formulário público)
CREATE POLICY "Anyone can view active sellers for registration"
  ON public.sellers FOR SELECT
  USING (is_active = true);