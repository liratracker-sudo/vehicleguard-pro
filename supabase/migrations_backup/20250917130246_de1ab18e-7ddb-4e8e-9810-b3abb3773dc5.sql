-- Criar notificações manualmente para pagamentos sem notificações
DO $$
DECLARE
  payment_record RECORD;
  settings_record RECORD;
  due_date_ts TIMESTAMP WITH TIME ZONE;
  notification_time TIMESTAMP WITH TIME ZONE;
  hours_parts INTEGER;
  minutes_parts INTEGER;
BEGIN
  -- Buscar configurações ativas da empresa
  SELECT * INTO settings_record
  FROM payment_notification_settings 
  WHERE company_id = 'c92f7c5a-51bd-4c86-9667-1020ee495b9b' 
  AND active = true
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Nenhuma configuração de notificação ativa encontrada';
    RETURN;
  END IF;
  
  -- Buscar pagamento sem notificações
  SELECT * INTO payment_record
  FROM payment_transactions 
  WHERE id = '45ae472a-4955-44bc-b176-44dc0bc93cc9'
  AND NOT EXISTS (
    SELECT 1 FROM payment_notifications 
    WHERE payment_id = '45ae472a-4955-44bc-b176-44dc0bc93cc9'
  );
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Pagamento não encontrado ou já possui notificações';
    RETURN;
  END IF;
  
  -- Parse do horário de envio (formato HH:MM:SS)
  hours_parts := EXTRACT(HOUR FROM settings_record.send_hour);
  minutes_parts := EXTRACT(MINUTE FROM settings_record.send_hour);
  
  -- Criar notificação on_due (no vencimento)
  IF settings_record.on_due THEN
    due_date_ts := payment_record.due_date::timestamp + make_time(hours_parts, minutes_parts, 0);
    
    INSERT INTO payment_notifications (
      company_id, payment_id, client_id, event_type, offset_days,
      scheduled_for, status, notification_settings_id, attempts
    ) VALUES (
      payment_record.company_id,
      payment_record.id,
      payment_record.client_id,
      'on_due',
      0,
      due_date_ts,
      'pending',
      settings_record.id,
      0
    );
    
    RAISE NOTICE 'Notificação on_due criada para %', due_date_ts;
  END IF;
  
  -- Criar notificações post_due (após vencimento)
  IF settings_record.post_due_days IS NOT NULL AND array_length(settings_record.post_due_days, 1) > 0 THEN
    FOR i IN 1..array_length(settings_record.post_due_days, 1) LOOP
      notification_time := payment_record.due_date::timestamp + 
                          make_interval(days => settings_record.post_due_days[i]) + 
                          make_time(hours_parts, minutes_parts, 0);
      
      INSERT INTO payment_notifications (
        company_id, payment_id, client_id, event_type, offset_days,
        scheduled_for, status, notification_settings_id, attempts
      ) VALUES (
        payment_record.company_id,
        payment_record.id,
        payment_record.client_id,
        'post_due',
        settings_record.post_due_days[i],
        notification_time,
        'pending',
        settings_record.id,
        0
      );
      
      RAISE NOTICE 'Notificação post_due criada para % dias (%)', settings_record.post_due_days[i], notification_time;
    END LOOP;
  END IF;
  
END $$;