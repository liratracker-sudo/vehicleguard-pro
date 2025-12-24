-- Fase 1: Escalar sistema de notificações para alto volume
-- 1. Aumentar execuções: 10x ao dia (8h-11h e 14h-16h Brasil = 11h-14h e 17h-19h UTC)
-- 2. Aumentar timeout: 300 segundos (máximo do pg_net)
-- 3. Capacidade estimada: ~200 notificações/dia

-- Remover cron atual
SELECT cron.unschedule(5);

-- Criar novo cron com 10 execuções diárias e timeout de 300s
-- Horários UTC: 11h, 11h30, 12h, 12h30, 13h, 13h30, 14h (manhã Brasil: 8h-11h)
--               17h, 18h, 19h (tarde Brasil: 14h-16h)
SELECT cron.schedule(
  'process-billing-notifications',
  '0,30 11,12,13,14 * * *',
  $$
  SELECT net.http_post(
    url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
    body:=concat('{"time": "', now(), '", "trigger": "cron_scheduled"}')::jsonb,
    timeout_milliseconds:=300000
  ) AS request_id;
  $$
);

-- Criar cron separado para horário da tarde (17h, 18h, 19h UTC = 14h, 15h, 16h Brasil)
SELECT cron.schedule(
  'process-billing-notifications-afternoon',
  '0 17,18,19 * * *',
  $$
  SELECT net.http_post(
    url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
    body:=concat('{"time": "', now(), '", "trigger": "cron_scheduled_afternoon"}')::jsonb,
    timeout_milliseconds:=300000
  ) AS request_id;
  $$
);