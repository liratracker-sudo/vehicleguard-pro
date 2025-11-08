-- Adicionar coluna para notificação de pagamento confirmado
ALTER TABLE payment_notification_settings
ADD COLUMN IF NOT EXISTS on_paid BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN payment_notification_settings.on_paid IS 'Enviar notificação automática via WhatsApp quando pagamento PIX for confirmado';