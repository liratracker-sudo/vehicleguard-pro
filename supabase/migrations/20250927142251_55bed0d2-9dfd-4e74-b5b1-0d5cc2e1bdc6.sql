-- Adicionar configurações para múltiplas notificações post-due por dia
ALTER TABLE payment_notification_settings 
ADD COLUMN post_due_times integer DEFAULT 2,
ADD COLUMN post_due_interval_hours integer DEFAULT 6;