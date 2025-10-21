-- Criar cron job para processar notificações de pagamento a cada hora
SELECT cron.schedule(
  'billing-notifications-hourly',
  '0 * * * *', -- A cada hora
  $$
  SELECT
    net.http_post(
      url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
      body:=json_build_object('trigger', 'cron_hourly', 'time', now())::jsonb
    ) as request_id;
  $$
);

-- Criar cron job para executar às 9h diariamente (horário principal)
SELECT cron.schedule(
  'billing-notifications-daily-9am',
  '0 9 * * *', -- Todo dia às 9h
  $$
  SELECT
    net.http_post(
      url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
      body:=json_build_object('trigger', 'manual_9am_start', 'time', now(), 'force', true)::jsonb
    ) as request_id;
  $$
);

-- Criar trigger para processar notificações quando um pagamento é criado ou atualizado
CREATE OR REPLACE FUNCTION trigger_notification_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Apenas processar se for pendente ou vencido
  IF NEW.status IN ('pending', 'overdue') AND NEW.due_date IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
      body := json_build_object(
        'trigger', 'payment_created',
        'payment_id', NEW.id::text,
        'company_id', NEW.company_id::text,
        'time', now()
      )::jsonb
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS on_payment_created_trigger ON payment_transactions;

-- Criar novo trigger otimizado
CREATE TRIGGER on_payment_created_trigger
  AFTER INSERT OR UPDATE OF status, due_date ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notification_check();