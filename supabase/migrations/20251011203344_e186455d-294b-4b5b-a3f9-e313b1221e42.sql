-- Remove existing billing notification cron jobs to avoid duplicates
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname LIKE 'billing-notifications%';

-- Create cron job to run billing notifications every day at 9 AM Brazil time (12 PM UTC)
-- Brazil is UTC-3, so 9 AM in Brazil = 12 PM UTC
SELECT cron.schedule(
  'billing-notifications-daily-9am',
  '0 12 * * *', -- Every day at 12:00 UTC (9 AM Brazil time)
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

-- Create cron job to check and send pending notifications every 30 minutes
SELECT cron.schedule(
  'billing-notifications-check-pending',
  '*/30 * * * *', -- Every 30 minutes
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