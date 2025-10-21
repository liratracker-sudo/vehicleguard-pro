-- Garantir que as extensões necessárias estão habilitadas
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA net;

-- Verificar se o cron job existe e recriar se necessário
DO $$
BEGIN
  -- Remover job antigo se existir
  PERFORM cron.unschedule('process-overdue-payments-every-30min');
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignorar erro se não existir
END $$;

-- Criar o cron job para processar cobranças vencidas a cada 30 minutos
SELECT cron.schedule(
  'process-overdue-payments-every-30min',
  '*/30 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/ai-collection',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
        body:=jsonb_build_object(
          'action', 'process_overdue_clients',
          'time', now()
        )
    ) as request_id;
  $$
);