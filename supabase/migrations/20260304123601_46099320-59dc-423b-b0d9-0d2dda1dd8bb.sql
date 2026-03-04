
-- Remover crons antigos de billing-notifications
SELECT cron.unschedule('process-billing-notifications');
SELECT cron.unschedule('process-billing-notifications-afternoon');

-- Recriar com offset de 2 minutos para evitar colisão com process-scheduled-reminders
SELECT cron.schedule(
  'process-billing-notifications',
  '2,32 11,12,13,14 * * *',
  $$
  SELECT net.http_post(
    url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
    body:=concat('{"time": "', now(), '", "trigger": "cron_scheduled"}')::jsonb,
    timeout_milliseconds:=300000
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'process-billing-notifications-afternoon',
  '2 17,18,19 * * *',
  $$
  SELECT net.http_post(
    url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
    body:=concat('{"time": "', now(), '", "trigger": "cron_scheduled_afternoon"}')::jsonb,
    timeout_milliseconds:=300000
  ) AS request_id;
  $$
);
