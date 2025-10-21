-- Criar trigger para executar função de notificações quando pagamento é criado
CREATE OR REPLACE FUNCTION public.trigger_billing_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Só processar se for um pagamento pendente ou vencido
  IF NEW.status IN ('pending', 'overdue') AND NEW.due_date IS NOT NULL THEN
    -- Executar função de notificações de forma assíncrona
    PERFORM supabase.functions.invoke('billing-notifications', 
      json_build_object(
        'trigger', 'payment_created',
        'payment_id', NEW.id::text,
        'company_id', NEW.company_id::text
      )::json
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;