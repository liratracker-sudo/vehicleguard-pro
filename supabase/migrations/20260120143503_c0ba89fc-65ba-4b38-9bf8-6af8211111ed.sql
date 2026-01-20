-- Remover constraint antiga que não permite 'sending'
ALTER TABLE payment_notifications 
DROP CONSTRAINT IF EXISTS payment_notifications_status_check;

-- Adicionar constraint com 'sending' para permitir lock otimista
ALTER TABLE payment_notifications 
ADD CONSTRAINT payment_notifications_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text, 'skipped'::text]));