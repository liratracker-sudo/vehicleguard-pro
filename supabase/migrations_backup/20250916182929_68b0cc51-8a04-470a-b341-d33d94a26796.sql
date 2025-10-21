-- Otimizar frequência do cron de notificações para 5 minutos para maior responsividade
SELECT cron.unschedule('billing-notifications-every-15-min')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'billing-notifications-every-15-min'
);

SELECT cron.unschedule('billing-notifications-job')  
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'billing-notifications-job'
);

-- Criar novo cron job otimizado para executar a cada 5 minutos
SELECT cron.schedule(
  'billing-notifications-optimized',
  '*/5 * * * *', -- A cada 5 minutos para maior responsividade
  $$
  SELECT
    net.http_post(
        url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
        body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);