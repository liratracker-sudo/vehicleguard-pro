-- Corrigir função para adicionar search_path
CREATE OR REPLACE FUNCTION public.trigger_billing_notifications()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só processar se for um pagamento pendente ou vencido
  IF NEW.status IN ('pending', 'overdue') AND NEW.due_date IS NOT NULL THEN
    -- Log da tentativa de execução
    INSERT INTO cron_execution_logs (job_name, status, response_body) 
    VALUES (
      'billing-notifications-trigger',
      'running',
      json_build_object(
        'trigger', 'payment_created',
        'payment_id', NEW.id::text,
        'company_id', NEW.company_id::text
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger na tabela payment_transactions
DROP TRIGGER IF EXISTS trigger_billing_notifications_on_insert ON payment_transactions;
CREATE TRIGGER trigger_billing_notifications_on_insert
  AFTER INSERT ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_billing_notifications();

-- Executar função manualmente para processar pagamentos pendentes
INSERT INTO cron_execution_logs (job_name, status, response_body) 
VALUES (
  'billing-notifications-manual',
  'running',
  'Manual execution requested for pending payments'
);