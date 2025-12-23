-- Atualizar cron para rodar às 9h, 10h e 11h (Brasília = 12h, 13h, 14h UTC)
SELECT cron.unschedule(4);

SELECT cron.schedule(
  'process-billing-notifications',
  '0 12,13,14 * * *',
  $$
  SELECT net.http_post(
    url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
    body:=concat('{"time": "', now(), '", "trigger": "cron_scheduled"}')::jsonb,
    timeout_milliseconds:=55000
  ) AS request_id;
  $$
);

-- Resetar notificações falhadas de hoje para reprocessamento
UPDATE payment_notifications 
SET status = 'pending', 
    attempts = 0,
    last_error = NULL
WHERE status = 'failed' 
AND scheduled_for::date = CURRENT_DATE;