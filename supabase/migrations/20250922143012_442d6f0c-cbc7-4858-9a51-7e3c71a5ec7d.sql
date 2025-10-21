-- Enable necessary extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule billing notifications to run every hour
SELECT cron.schedule(
  'billing-notifications-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
        body:=concat('{"trigger": "cron_hourly", "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Schedule billing notifications for 9AM daily (high priority time)
SELECT cron.schedule(
  'billing-notifications-9am',
  '0 9 * * *', -- Every day at 9:00 AM
  $$
  SELECT
    net.http_post(
        url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
        body:=concat('{"trigger": "manual_9am_start", "force": true, "scheduled_time": "09:00", "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Create default notification settings for companies that don't have them
INSERT INTO payment_notification_settings (
  company_id,
  active,
  pre_due_days,
  on_due,
  post_due_days,
  send_hour,
  on_due_times,
  on_due_interval_hours,
  max_attempts_per_notification,
  retry_interval_hours
)
SELECT 
  c.id as company_id,
  true as active,
  ARRAY[3] as pre_due_days,
  true as on_due,
  ARRAY[1, 3, 7] as post_due_days,
  '09:00:00'::time as send_hour,
  1 as on_due_times,
  2 as on_due_interval_hours,
  3 as max_attempts_per_notification,
  1 as retry_interval_hours
FROM companies c
LEFT JOIN payment_notification_settings pns ON c.id = pns.company_id
WHERE c.is_active = true 
  AND pns.id IS NULL;

-- Update payment status for overdue payments
UPDATE payment_transactions 
SET status = 'overdue', updated_at = now()
WHERE status = 'pending' 
  AND due_date < CURRENT_DATE
  AND due_date >= CURRENT_DATE - INTERVAL '90 days';

-- Create index for better performance on notification queries
CREATE INDEX IF NOT EXISTS idx_payment_notifications_pending_scheduled 
ON payment_notifications (company_id, status, scheduled_for) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_payment_transactions_overdue_company 
ON payment_transactions (company_id, status, due_date) 
WHERE status IN ('pending', 'overdue');

-- Function to ensure system clients exist for all companies
CREATE OR REPLACE FUNCTION ensure_system_client_for_company(company_uuid UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  system_client_id UUID;
  company_info RECORD;
BEGIN
  -- Check if system client already exists
  SELECT id INTO system_client_id
  FROM clients
  WHERE company_id = company_uuid
    AND name = 'Sistema - Cobrança Automática';
    
  IF system_client_id IS NOT NULL THEN
    RETURN system_client_id;
  END IF;
  
  -- Get company info
  SELECT name, email, phone INTO company_info
  FROM companies
  WHERE id = company_uuid;
  
  -- Create system client
  INSERT INTO clients (
    company_id,
    name,
    email,
    phone,
    document,
    status
  ) VALUES (
    company_uuid,
    'Sistema - Cobrança Automática',
    COALESCE(company_info.email, 'sistema@empresa.com'),
    COALESCE(company_info.phone, '11999999999'),
    'SISTEMA',
    'active'
  ) RETURNING id INTO system_client_id;
  
  RETURN system_client_id;
END;
$$;