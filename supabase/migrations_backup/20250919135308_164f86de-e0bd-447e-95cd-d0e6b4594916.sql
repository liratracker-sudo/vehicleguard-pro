-- Create a cron job to trigger billing notifications at 9:00 AM every day
-- First, ensure pg_cron and pg_net extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- Schedule the billing notifications function to run every day at 9:00 AM
SELECT cron.schedule(
  'billing-notifications-9am',
  '0 9 * * *', -- Every day at 9:00 AM
  $$
  SELECT
    net.http_post(
      url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
      body:=concat('{"trigger": "cron_9am", "force": false, "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Create another cron job to process any missed notifications every 15 minutes during business hours (8AM-6PM)
SELECT cron.schedule(
  'billing-notifications-cleanup',
  '*/15 8-18 * * *', -- Every 15 minutes from 8 AM to 6 PM
  $$
  SELECT
    net.http_post(
      url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
      body:=concat('{"trigger": "cron_cleanup", "force": false, "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Create a function to check cron job status
CREATE OR REPLACE FUNCTION get_billing_cron_status()
RETURNS TABLE(
  jobname text,
  schedule text,
  active boolean,
  created_at timestamptz
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 
    jobname::text,
    schedule::text,
    active,
    created_at
  FROM cron.job 
  WHERE jobname LIKE 'billing-notifications%'
  ORDER BY jobname;
$$;