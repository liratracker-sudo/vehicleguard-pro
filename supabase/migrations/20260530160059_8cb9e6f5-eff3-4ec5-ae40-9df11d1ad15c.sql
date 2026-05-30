-- Manual PIX settings (one per company)
CREATE TABLE IF NOT EXISTS public.manual_pix_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  pix_key TEXT NOT NULL,
  pix_key_type TEXT NOT NULL CHECK (pix_key_type IN ('cpf','cnpj','email','phone','aleatoria')),
  beneficiary_name TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage','fixed')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  surcharge_type TEXT NOT NULL DEFAULT 'percentage' CHECK (surcharge_type IN ('percentage','fixed')),
  surcharge_value NUMERIC NOT NULL DEFAULT 0,
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_pix_settings TO authenticated;
GRANT ALL ON public.manual_pix_settings TO service_role;

ALTER TABLE public.manual_pix_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage manual pix settings"
ON public.manual_pix_settings
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.company_id = manual_pix_settings.company_id))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.company_id = manual_pix_settings.company_id));

CREATE TRIGGER trg_manual_pix_settings_updated_at
BEFORE UPDATE ON public.manual_pix_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit columns on payment_transactions for manual PIX confirmation
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS manual_pix_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manual_pix_confirmed_by UUID,
  ADD COLUMN IF NOT EXISTS manual_pix_proof_url TEXT;

-- Public RPC for checkout to fetch manual PIX info if no gateway is active
CREATE OR REPLACE FUNCTION public.get_manual_pix_checkout(p_payment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_settings RECORD;
  v_has_gateway BOOLEAN;
  v_amount NUMERIC;
  v_original NUMERIC;
  v_today DATE;
  v_due DATE;
  v_is_overdue BOOLEAN;
  v_discount NUMERIC := 0;
  v_surcharge NUMERIC := 0;
BEGIN
  SELECT id, company_id, amount, due_date, status
    INTO v_payment
  FROM public.payment_transactions
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('enabled', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO v_settings
  FROM public.manual_pix_settings
  WHERE company_id = v_payment.company_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('enabled', false, 'reason', 'disabled');
  END IF;

  -- Check if any gateway is active for the company
  SELECT EXISTS (
    SELECT 1 FROM public.asaas_settings WHERE company_id = v_payment.company_id AND is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.mercadopago_settings WHERE company_id = v_payment.company_id AND is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.inter_settings WHERE company_id = v_payment.company_id AND is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.gerencianet_settings WHERE company_id = v_payment.company_id AND is_active = true
  ) INTO v_has_gateway;

  IF v_has_gateway THEN
    RETURN jsonb_build_object('enabled', false, 'reason', 'gateway_active');
  END IF;

  v_original := v_payment.amount;
  v_today := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_due := v_payment.due_date;
  v_is_overdue := v_today > v_due;

  IF v_is_overdue THEN
    IF v_settings.surcharge_type = 'percentage' THEN
      v_surcharge := ROUND(v_original * v_settings.surcharge_value / 100.0, 2);
    ELSE
      v_surcharge := v_settings.surcharge_value;
    END IF;
    v_amount := v_original + v_surcharge;
  ELSE
    IF v_settings.discount_type = 'percentage' THEN
      v_discount := ROUND(v_original * v_settings.discount_value / 100.0, 2);
    ELSE
      v_discount := v_settings.discount_value;
    END IF;
    v_amount := GREATEST(v_original - v_discount, 0);
  END IF;

  RETURN jsonb_build_object(
    'enabled', true,
    'pix_key', v_settings.pix_key,
    'pix_key_type', v_settings.pix_key_type,
    'beneficiary_name', v_settings.beneficiary_name,
    'instructions', v_settings.instructions,
    'original_amount', v_original,
    'amount_due', v_amount,
    'discount_applied', v_discount,
    'surcharge_applied', v_surcharge,
    'is_overdue', v_is_overdue,
    'due_date', v_due,
    'discount_type', v_settings.discount_type,
    'discount_value', v_settings.discount_value,
    'surcharge_type', v_settings.surcharge_type,
    'surcharge_value', v_settings.surcharge_value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_manual_pix_checkout(UUID) TO anon, authenticated;