-- =============================================
-- PROTEÇÃO CONTRA PERDA DE DADOS
-- =============================================

-- 1. Alterar payment_transactions_client_id_fkey de CASCADE para SET NULL
ALTER TABLE payment_transactions 
DROP CONSTRAINT IF EXISTS payment_transactions_client_id_fkey;

ALTER TABLE payment_transactions 
ADD CONSTRAINT payment_transactions_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- 2. Alterar payment_notifications_payment_id_fkey de CASCADE para SET NULL
ALTER TABLE payment_notifications 
DROP CONSTRAINT IF EXISTS payment_notifications_payment_id_fkey;

ALTER TABLE payment_notifications 
ADD CONSTRAINT payment_notifications_payment_id_fkey 
FOREIGN KEY (payment_id) REFERENCES payment_transactions(id) ON DELETE SET NULL;

-- 3. Alterar payment_notifications_client_id_fkey de CASCADE para SET NULL
ALTER TABLE payment_notifications 
DROP CONSTRAINT IF EXISTS payment_notifications_client_id_fkey;

ALTER TABLE payment_notifications 
ADD CONSTRAINT payment_notifications_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- =============================================
-- TABELA DE AUDITORIA
-- =============================================

-- Criar tabela de auditoria se não existir
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política para super_admin ver todos os logs
CREATE POLICY "Super admins can view all audit logs"
ON public.audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'super_admin'
  )
);

-- Política para admin ver logs da própria empresa
CREATE POLICY "Admins can view company audit logs"
ON public.audit_logs
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id);

-- =============================================
-- TRIGGERS DE AUDITORIA
-- =============================================

-- Trigger para contracts (já existe a função, só recriar trigger)
DROP TRIGGER IF EXISTS audit_contracts_trigger ON contracts;
CREATE TRIGGER audit_contracts_trigger
AFTER UPDATE OR DELETE ON contracts
FOR EACH ROW EXECUTE FUNCTION audit_contract_changes();

-- Trigger para payment_transactions (já existe a função, só recriar trigger)
DROP TRIGGER IF EXISTS audit_payments_trigger ON payment_transactions;
CREATE TRIGGER audit_payments_trigger
AFTER DELETE ON payment_transactions
FOR EACH ROW EXECUTE FUNCTION audit_payment_changes();