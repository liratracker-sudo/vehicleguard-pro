-- Tabela para log de emails de reengajamento
CREATE TABLE public.reengagement_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  admin_name TEXT,
  template_type TEXT NOT NULL DEFAULT 'first_reminder',
  sent_at TIMESTAMPTZ DEFAULT now(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_message TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
);

-- Index para buscar por company_id
CREATE INDEX idx_reengagement_email_logs_company_id ON public.reengagement_email_logs(company_id);

-- Index para buscar por data de envio
CREATE INDEX idx_reengagement_email_logs_sent_at ON public.reengagement_email_logs(sent_at);

-- RLS
ALTER TABLE public.reengagement_email_logs ENABLE ROW LEVEL SECURITY;

-- Super admins podem ver todos os logs
CREATE POLICY "Super admins can view all reengagement logs"
  ON public.reengagement_email_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Sistema pode inserir logs
CREATE POLICY "System can insert reengagement logs"
  ON public.reengagement_email_logs
  FOR INSERT
  WITH CHECK (true);

-- Comentário na tabela
COMMENT ON TABLE public.reengagement_email_logs IS 'Logs de emails de reengajamento enviados para empresas inativas';