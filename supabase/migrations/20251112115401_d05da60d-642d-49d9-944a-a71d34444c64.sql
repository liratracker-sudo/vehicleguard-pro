-- Habilitar extensões necessárias (se ainda não estiverem habilitadas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Criar CRON job para processar notificações de cobrança a cada hora
SELECT cron.schedule(
  'process-billing-notifications-hourly',
  '0 * * * *', -- A cada hora no minuto 0
  $$
  SELECT
    net.http_post(
        url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) AS request_id;
  $$
);