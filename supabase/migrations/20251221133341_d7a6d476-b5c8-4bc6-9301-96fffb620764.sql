
-- 1. Marcar o cron de hoje como failed
UPDATE cron_execution_logs 
SET status = 'failed', 
    finished_at = NOW(), 
    error_message = 'pg_net timeout de 5s - timeout configurado muito baixo'
WHERE status = 'running' 
AND job_name LIKE 'billing-notifications%'
AND started_at > '2025-12-21';

-- 2. Deletar o cron job antigo (usando jobid)
SELECT cron.unschedule(2);

-- 3. Recriar com timeout de 55 segundos
SELECT cron.schedule(
  'process-billing-notifications-9am',
  '0 12 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
        body:=concat('{"time": "', now(), '", "trigger": "cron_9am"}')::jsonb,
        timeout_milliseconds:=55000
    ) AS request_id;
  $$
);
