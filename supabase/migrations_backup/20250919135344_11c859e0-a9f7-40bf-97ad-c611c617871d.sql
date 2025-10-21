-- Fix the cron status function by removing the non-existent created_at column
CREATE OR REPLACE FUNCTION get_billing_cron_status()
RETURNS TABLE(
  jobname text,
  schedule text,
  active boolean
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 
    jobname::text,
    schedule::text,
    active
  FROM cron.job 
  WHERE jobname LIKE 'billing-notifications%'
  ORDER BY jobname;
$$;