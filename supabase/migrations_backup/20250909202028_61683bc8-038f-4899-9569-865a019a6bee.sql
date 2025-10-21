-- Enable realtime for payment_transactions table
ALTER TABLE public.payment_transactions REPLICA IDENTITY FULL;

-- Add payment_transactions to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_transactions;

-- Create a cron job to sync Asaas payments every 15 minutes
SELECT cron.schedule(
  'asaas-sync-payments',
  '*/15 * * * *', -- every 15 minutes
  $$
  SELECT
    net.http_post(
      url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/asaas-sync-payments',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
      body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);