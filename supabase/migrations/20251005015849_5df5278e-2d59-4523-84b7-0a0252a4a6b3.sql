-- Fix cron job: usar headers como texto simples ao invés de jsonb
DO $$
BEGIN
  -- Remover job antigo
  PERFORM cron.unschedule('process-overdue-payments-every-30min');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Criar cron job CORRIGIDO com headers como texto
SELECT cron.schedule(
  'process-overdue-payments-every-30min',
  '*/30 * * * *',
  $$
  SELECT
    net.http_post(
        url := 'https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/ai-collection',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}',
        body := '{"action": "process_overdue_clients"}'
    ) as request_id;
  $$
);