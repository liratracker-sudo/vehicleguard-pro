
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_company_instance
  ON public.whatsapp_sessions (company_id, instance_name);

CREATE INDEX IF NOT EXISTS idx_contracts_assinafy_document_id
  ON public.contracts (assinafy_document_id)
  WHERE assinafy_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_notifications_payment_status
  ON public.payment_notifications (payment_id, status);

CREATE INDEX IF NOT EXISTS idx_payment_notifications_payment_event_status_sent
  ON public.payment_notifications (payment_id, event_type, status, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_settings_instance_active
  ON public.whatsapp_settings (instance_name)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_status_scheduled
  ON public.scheduled_reminders (status, scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_clients_company_phone
  ON public.clients (company_id, phone);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_company_status_due
  ON public.payment_transactions (company_id, status, due_date);
