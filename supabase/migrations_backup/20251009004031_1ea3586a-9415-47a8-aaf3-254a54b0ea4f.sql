-- Criar tabela para lembretes e tarefas agendadas
CREATE TABLE IF NOT EXISTS public.scheduled_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  manager_phone TEXT NOT NULL,
  reminder_text TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  action_type TEXT NOT NULL DEFAULT 'reminder' CHECK (action_type IN ('reminder', 'collection')),
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar índices para performance
CREATE INDEX idx_scheduled_reminders_company ON scheduled_reminders(company_id);
CREATE INDEX idx_scheduled_reminders_status ON scheduled_reminders(status);
CREATE INDEX idx_scheduled_reminders_scheduled_for ON scheduled_reminders(scheduled_for);

-- RLS Policies
ALTER TABLE scheduled_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's reminders"
  ON scheduled_reminders FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert reminders"
  ON scheduled_reminders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update reminders"
  ON scheduled_reminders FOR UPDATE
  USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_scheduled_reminders_updated_at
  BEFORE UPDATE ON scheduled_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE scheduled_reminders IS 'Armazena lembretes e tarefas agendadas pelo assistente de IA';
COMMENT ON COLUMN scheduled_reminders.action_type IS 'Tipo de ação: reminder (lembrete) ou collection (cobrança agendada)';
COMMENT ON COLUMN scheduled_reminders.metadata IS 'Dados adicionais como payment_id para cobranças agendadas';