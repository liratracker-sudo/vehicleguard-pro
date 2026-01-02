-- Add service_status field to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS service_status text DEFAULT 'active' 
CHECK (service_status IN ('active', 'warning', 'suspended', 'blocked'));

-- Create table to track escalation history
CREATE TABLE public.client_escalation_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  previous_status text,
  new_status text NOT NULL,
  escalation_level integer NOT NULL DEFAULT 1,
  days_overdue integer NOT NULL,
  action_type text NOT NULL, -- 'notification_sent', 'status_changed', 'manual_suspension', 'manual_reactivation'
  action_details text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid -- null for automatic, user_id for manual
);

-- Enable RLS
ALTER TABLE public.client_escalation_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Company members can view escalation history"
ON public.client_escalation_history
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid() 
  AND profiles.company_id = client_escalation_history.company_id
));

CREATE POLICY "Company members can insert escalation history"
ON public.client_escalation_history
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid() 
  AND profiles.company_id = client_escalation_history.company_id
));

CREATE POLICY "System can insert escalation history"
ON public.client_escalation_history
FOR INSERT
WITH CHECK (true);

-- Add escalation template fields to payment_notification_settings
ALTER TABLE public.payment_notification_settings
ADD COLUMN IF NOT EXISTS template_post_due_warning text DEFAULT 'Olá {{cliente}}, seu pagamento de R$ {{valor}} está com {{dias}} dias de atraso. Regularize para evitar a suspensão do serviço. Pague aqui: {{link}}',
ADD COLUMN IF NOT EXISTS template_post_due_urgent text DEFAULT 'AVISO: {{cliente}}, sua conta está {{dias}} dias atrasada. Seu serviço será SUSPENSO em breve se não regularizar. Valor: R$ {{valor}}. Pague agora: {{link}}',
ADD COLUMN IF NOT EXISTS template_post_due_final text DEFAULT 'ÚLTIMO AVISO: {{cliente}}, seu serviço será SUSPENSO EM 24H! Pagamento de R$ {{valor}} com {{dias}} dias de atraso. Regularize AGORA: {{link}}',
ADD COLUMN IF NOT EXISTS template_suspended text DEFAULT '{{cliente}}, seu serviço foi SUSPENSO por inadimplência de R$ {{valor}}. Para reativar, quite seu débito: {{link}}',
ADD COLUMN IF NOT EXISTS auto_suspension_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS suspension_after_days integer DEFAULT 21;

-- Create index for faster queries on overdue payments
CREATE INDEX IF NOT EXISTS idx_payment_transactions_overdue 
ON public.payment_transactions(company_id, status, due_date) 
WHERE status IN ('pending', 'overdue');