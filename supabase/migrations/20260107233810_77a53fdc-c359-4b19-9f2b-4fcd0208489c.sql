-- Tabela de configurações de notificação de despesas
CREATE TABLE public.expense_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  
  -- Dias antes do vencimento para notificar (array de inteiros)
  pre_due_days INTEGER[] DEFAULT '{3, 1}',
  
  -- Notificar no dia do vencimento
  notify_on_due BOOLEAN DEFAULT true,
  
  -- Dias após vencimento para notificar (array de inteiros)
  post_due_days INTEGER[] DEFAULT '{1, 3, 7}',
  
  -- Horário de envio (formato HH:MM)
  send_hour TEXT DEFAULT '08:00',
  
  -- Templates de mensagem
  template_pre_due TEXT DEFAULT '⚠️ *Conta a Vencer*

📋 {{descricao}}
💰 Valor: R$ {{valor}}
📅 Vence em: {{dias}} dia(s)
🗓️ Vencimento: {{vencimento}}',

  template_on_due TEXT DEFAULT '🔔 *Conta Vence Hoje!*

📋 {{descricao}}
💰 Valor: R$ {{valor}}
🗓️ Vencimento: {{vencimento}}',

  template_post_due TEXT DEFAULT '🚨 *Conta Vencida*

📋 {{descricao}}
💰 Valor: R$ {{valor}}
⏰ Vencida há: {{dias}} dia(s)
🗓️ Vencimento: {{vencimento}}',

  -- Resumo diário
  send_daily_summary BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.expense_notification_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own company settings
CREATE POLICY "Users can view own company expense notification settings"
ON public.expense_notification_settings
FOR SELECT
USING (company_id IN (
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
));

-- Policy: Admins can insert settings
CREATE POLICY "Admins can insert expense notification settings"
ON public.expense_notification_settings
FOR INSERT
WITH CHECK (company_id IN (
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'
));

-- Policy: Admins can update settings
CREATE POLICY "Admins can update expense notification settings"
ON public.expense_notification_settings
FOR UPDATE
USING (company_id IN (
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'
));

-- Policy: Admins can delete settings
CREATE POLICY "Admins can delete expense notification settings"
ON public.expense_notification_settings
FOR DELETE
USING (company_id IN (
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_expense_notification_settings_updated_at
BEFORE UPDATE ON public.expense_notification_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de logs de notificações enviadas
CREATE TABLE public.expense_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'pre_due', 'on_due', 'post_due', 'daily_summary'
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.expense_notification_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view own company logs
CREATE POLICY "Users can view own company expense notification logs"
ON public.expense_notification_logs
FOR SELECT
USING (company_id IN (
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
));

-- Índices para performance
CREATE INDEX idx_expense_notification_logs_company ON public.expense_notification_logs(company_id);
CREATE INDEX idx_expense_notification_logs_expense ON public.expense_notification_logs(expense_id);
CREATE INDEX idx_expense_notification_logs_created ON public.expense_notification_logs(created_at DESC);