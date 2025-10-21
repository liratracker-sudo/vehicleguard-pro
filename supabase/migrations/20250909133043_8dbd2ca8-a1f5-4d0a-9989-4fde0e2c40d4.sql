-- Adicionar 'manual' aos valores aceitos no event_type da tabela payment_notifications
ALTER TABLE payment_notifications 
DROP CONSTRAINT IF EXISTS payment_notifications_event_type_check;

ALTER TABLE payment_notifications 
ADD CONSTRAINT payment_notifications_event_type_check 
CHECK (event_type = ANY (ARRAY['pre_due'::text, 'on_due'::text, 'post_due'::text, 'manual'::text]));