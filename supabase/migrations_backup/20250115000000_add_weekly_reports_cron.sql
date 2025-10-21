-- Create cron job for weekly reports automation
-- This will call the weekly-reports-cron edge function every hour from 6 AM to 10 PM

-- Ensure pg_cron and http extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- Schedule the weekly reports function to run every hour from 6 AM to 10 PM
SELECT cron.schedule(
  'weekly-reports-automation',
  '0 6-22 * * *', -- Every hour from 6 AM to 10 PM
  $$
  SELECT
    net.http_post(
      url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/weekly-reports-cron',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
      body:=concat('{"trigger": "cron_weekly_reports", "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Log the cron job creation
INSERT INTO cron_execution_logs (job_name, status, details, created_at)
VALUES ('weekly-reports-automation', 'created', 'Weekly reports cron job created successfully', now());