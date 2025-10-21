-- Habilitar extensões necessárias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Configurar cron job para executar billing-notifications a cada 15 minutos
SELECT cron.schedule(
  'billing-notifications-job',
  '*/15 * * * *', -- A cada 15 minutos
  $$
  SELECT
    net.http_post(
        url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Melhorar configurações de notificação para mais granularidade
ALTER TABLE payment_notification_settings 
ADD COLUMN IF NOT EXISTS on_due_times integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS on_due_interval_hours integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS max_attempts_per_notification integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS retry_interval_hours integer DEFAULT 1;

-- Comentar as configurações
COMMENT ON COLUMN payment_notification_settings.on_due_times IS 'Quantidade de disparos no dia do vencimento';
COMMENT ON COLUMN payment_notification_settings.on_due_interval_hours IS 'Intervalo em horas entre disparos no dia do vencimento';
COMMENT ON COLUMN payment_notification_settings.max_attempts_per_notification IS 'Máximo de tentativas por notificação';
COMMENT ON COLUMN payment_notification_settings.retry_interval_hours IS 'Intervalo em horas para nova tentativa em caso de falha';

-- Atualizar dados existentes com valores padrão
UPDATE payment_notification_settings 
SET 
  on_due_times = 1,
  on_due_interval_hours = 2,
  max_attempts_per_notification = 3,
  retry_interval_hours = 1
WHERE on_due_times IS NULL;