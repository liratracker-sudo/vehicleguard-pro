-- Criar função que envia notificação de pagamento confirmado
CREATE OR REPLACE FUNCTION notify_payment_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o status mudou para 'paid' e não era 'paid' antes
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    -- Chamar edge function de forma assíncrona usando pg_net
    PERFORM
      net.http_post(
        url := 'https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/payment-confirmed-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw'
        ),
        body := jsonb_build_object(
          'payment_id', NEW.id
        )
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para chamar a função quando o pagamento for atualizado
DROP TRIGGER IF EXISTS payment_confirmed_trigger ON payment_transactions;

CREATE TRIGGER payment_confirmed_trigger
  AFTER UPDATE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_payment_confirmed();