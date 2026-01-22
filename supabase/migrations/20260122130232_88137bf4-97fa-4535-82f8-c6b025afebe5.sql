-- Adicionar campo para identificar motivo do cancelamento
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

COMMENT ON COLUMN payment_transactions.cancellation_reason IS 
'Motivo do cancelamento: expired (expiração automática), manual (cancelado pelo usuário), gateway (cancelado pelo gateway)';