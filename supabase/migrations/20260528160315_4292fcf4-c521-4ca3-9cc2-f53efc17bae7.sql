-- 1. RPCs
CREATE OR REPLACE FUNCTION public.get_checkout_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment payment_transactions%ROWTYPE;
  v_client jsonb;
  v_company jsonb;
  v_methods jsonb;
  v_rules jsonb;
BEGIN
  SELECT * INTO v_payment FROM payment_transactions WHERE id = p_payment_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT jsonb_build_object('name', c.name, 'email', c.email, 'phone', c.phone, 'document', c.document)
    INTO v_client FROM clients c WHERE c.id = v_payment.client_id;

  SELECT jsonb_build_object('name', co.name, 'logo_url', co.logo_url)
    INTO v_company FROM companies co WHERE co.id = v_payment.company_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'payment_method', m.payment_method, 'gateway_type', m.gateway_type
  )), '[]'::jsonb) INTO v_methods
  FROM payment_gateway_methods m
  WHERE m.company_id = v_payment.company_id AND m.is_active = true;

  SELECT COALESCE(jsonb_agg(to_jsonb(r.*) ORDER BY r.priority ASC), '[]'::jsonb) INTO v_rules
  FROM payment_gateway_rules r
  WHERE r.company_id = v_payment.company_id
    AND r.is_active = true
    AND r.min_amount <= v_payment.amount
    AND (r.max_amount IS NULL OR r.max_amount >= v_payment.amount);

  RETURN jsonb_build_object(
    'id', v_payment.id, 'amount', v_payment.amount, 'due_date', v_payment.due_date,
    'status', v_payment.status, 'company_id', v_payment.company_id,
    'payment_url', v_payment.payment_url, 'pix_code', v_payment.pix_code, 'barcode', v_payment.barcode,
    'original_amount', v_payment.original_amount, 'fine_amount', v_payment.fine_amount,
    'interest_amount', v_payment.interest_amount, 'days_overdue', v_payment.days_overdue,
    'cancellation_reason', v_payment.cancellation_reason, 'external_id', v_payment.external_id,
    'client', v_client, 'company', v_company,
    'gateway_methods', v_methods, 'gateway_rules', v_rules
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_checkout_payment(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_company_branding_by_slug(p_slug text)
RETURNS TABLE(id uuid, name text, logo_url text, primary_color text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.logo_url, c.primary_color
  FROM companies c WHERE c.slug = p_slug AND c.is_active = true LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_company_branding_by_slug(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_active_sellers_for_company(p_company_id uuid)
RETURNS TABLE(id uuid, name text, code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.code FROM sellers s
  WHERE s.company_id = p_company_id AND s.is_active = true;
$$;
GRANT EXECUTE ON FUNCTION public.get_active_sellers_for_company(uuid) TO anon, authenticated;

-- 2. Drop policies públicas
DROP POLICY IF EXISTS "Public can view clients for checkout" ON public.clients;
DROP POLICY IF EXISTS "Public can view companies for checkout" ON public.companies;
DROP POLICY IF EXISTS "Public can view payment for checkout" ON public.payment_transactions;
DROP POLICY IF EXISTS "Public can view payment gateway methods" ON public.payment_gateway_methods;
DROP POLICY IF EXISTS "Anyone can view active sellers for registration" ON public.sellers;

-- 3. cron_execution_logs
DROP POLICY IF EXISTS "System can manage cron logs" ON public.cron_execution_logs;
CREATE POLICY "Super admins can view cron logs"
ON public.cron_execution_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- 4. Fix broken INSERT policies
DROP POLICY IF EXISTS "Company can insert own payment notifications" ON public.payment_notifications;
CREATE POLICY "Company can insert own payment notifications"
ON public.payment_notifications FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles p
  WHERE p.user_id = auth.uid() AND p.company_id = payment_notifications.company_id));

DROP POLICY IF EXISTS "Company can insert own notification settings" ON public.payment_notification_settings;
CREATE POLICY "Company can insert own notification settings"
ON public.payment_notification_settings FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles p
  WHERE p.user_id = auth.uid() AND p.company_id = payment_notification_settings.company_id));

-- 5. Drop "true" policies
DROP POLICY IF EXISTS "System can insert escalation history" ON public.client_escalation_history;
DROP POLICY IF EXISTS "System can insert reminders" ON public.scheduled_reminders;
DROP POLICY IF EXISTS "System can update reminders" ON public.scheduled_reminders;
DROP POLICY IF EXISTS "System can insert alerts" ON public.system_alerts;

-- 6. company_branding column-level restriction for SMTP
REVOKE SELECT ON public.company_branding FROM authenticated;
GRANT SELECT (
  id, company_id, logo_url, primary_color, secondary_color, favicon_url,
  subdomain, smtp_from_email, smtp_from_name, terms_of_service, privacy_policy,
  theme_mode, created_at, updated_at
) ON public.company_branding TO authenticated;

DROP POLICY IF EXISTS "Admins can view branding SMTP" ON public.company_branding;
CREATE POLICY "Admins can view branding SMTP"
ON public.company_branding FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.company_id = company_branding.company_id
      AND p.role IN ('admin', 'super_admin')
  )
);
GRANT SELECT (smtp_host, smtp_port, smtp_user, smtp_password)
ON public.company_branding TO authenticated;

-- 7. storage client-documents
DROP POLICY IF EXISTS "Anyone can upload client documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view client documents" ON storage.objects;

CREATE POLICY "Company members can view their client documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'client-documents'
  AND EXISTS (
    SELECT 1 FROM public.client_registrations cr
    JOIN public.profiles p ON p.company_id = cr.company_id
    WHERE p.user_id = auth.uid()
      AND (storage.foldername(name))[1] = cr.id::text
  )
);

-- 8. search_path
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.notify_payment_confirmed() SET search_path = public;
ALTER FUNCTION public.audit_contract_changes() SET search_path = public;
ALTER FUNCTION public.audit_payment_changes() SET search_path = public;
ALTER FUNCTION public.encrypt_whatsapp_token(text) SET search_path = public;
ALTER FUNCTION public.decrypt_whatsapp_token(text) SET search_path = public;
ALTER FUNCTION public.encrypt_mercadopago_credential(text) SET search_path = public;
ALTER FUNCTION public.decrypt_mercadopago_credential(text) SET search_path = public;
ALTER FUNCTION public.encrypt_mercadopago_credential(uuid, text) SET search_path = public;
ALTER FUNCTION public.decrypt_mercadopago_credential(uuid, text) SET search_path = public;