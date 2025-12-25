-- Tabela para registrar notificações enviadas aos admins (rate limiting)
CREATE TABLE public.admin_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'whatsapp_disconnected', 'ai_failure', 'billing_error'
  sent_via TEXT NOT NULL DEFAULT 'email', -- 'email', 'sms', 'whatsapp'
  recipient TEXT NOT NULL, -- email ou telefone do admin
  subject TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index para busca rápida de notificações recentes por empresa/tipo
CREATE INDEX idx_admin_notification_logs_company_type ON public.admin_notification_logs(company_id, notification_type, created_at DESC);

-- RLS
ALTER TABLE public.admin_notification_logs ENABLE ROW LEVEL SECURITY;

-- Policy para admins da empresa visualizarem seus logs
CREATE POLICY "Company admins can view their notification logs"
  ON public.admin_notification_logs
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = admin_notification_logs.company_id
  ));

-- Policy para sistema inserir logs (edge functions)
CREATE POLICY "System can insert notification logs"
  ON public.admin_notification_logs
  FOR INSERT
  WITH CHECK (true);