-- Adicionar foreign key entre payment_notifications e payment_notification_settings
ALTER TABLE payment_notifications 
ADD COLUMN notification_settings_id UUID REFERENCES payment_notification_settings(id);

-- Criar índice para performance
CREATE INDEX idx_payment_notifications_settings_id ON payment_notifications(notification_settings_id);