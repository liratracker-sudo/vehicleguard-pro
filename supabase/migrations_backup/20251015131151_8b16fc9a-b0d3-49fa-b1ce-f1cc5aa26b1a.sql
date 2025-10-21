-- Ajustar cronjob para rodar a cada 5 minutos em vez de 30
-- Isso garante que as notificações sejam criadas e enviadas no momento correto

SELECT cron.unschedule('billing-notifications-check-pending');

SELECT cron.schedule(
  'billing-notifications-check-pending',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT net.http_post(
    url := 'https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw'
    ),
    body := jsonb_build_object(
      'trigger', 'scheduled_check',
      'force', false,
      'time', now()
    )
  ) as request_id;
  $$
);

-- Garantir que o cronjob das 9h (12:00 UTC) rode com force=true
SELECT cron.unschedule('billing-notifications-daily-9am');

SELECT cron.schedule(
  'billing-notifications-daily-9am',
  '0 12 * * *', -- 9:00 BRT (12:00 UTC)
  $$
  SELECT net.http_post(
    url := 'https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw'
    ),
    body := jsonb_build_object(
      'trigger', 'manual_9am_start',
      'force', true,
      'time', now()
    )
  ) as request_id;
  $$
);

-- Criar cronjob adicional para às 15h (18:00 UTC) para garantir segundo envio do dia
SELECT cron.schedule(
  'billing-notifications-daily-3pm',
  '0 18 * * *', -- 15:00 BRT (18:00 UTC)
  $$
  SELECT net.http_post(
    url := 'https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw'
    ),
    body := jsonb_build_object(
      'trigger', 'afternoon_check',
      'force', true,
      'time', now()
    )
  ) as request_id;
  $$
);