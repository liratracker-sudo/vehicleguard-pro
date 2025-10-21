-- Correção do problema de timezone nas notificações de cobrança
-- O problema: notificações estavam sendo enviadas às 21h ao invés de 9h e 15h
-- Causa: função setBrazilTime() na Edge Function estava calculando horário incorretamente
-- Solução: Limpar notificações pendentes com horário incorreto e recriar com horário correto

-- 1. Primeiro, vamos identificar e limpar notificações pendentes com horário incorreto
-- Notificações que foram agendadas para horários fora do padrão (9h e 15h Brasil)
DELETE FROM payment_notifications 
WHERE status = 'pending' 
AND (
  -- Notificações agendadas para horários incorretos (ex: 21h, 00h, etc)
  EXTRACT(HOUR FROM scheduled_for AT TIME ZONE 'America/Sao_Paulo') NOT IN (9, 15)
  OR 
  -- Notificações muito antigas (mais de 7 dias no passado)
  scheduled_for < NOW() - INTERVAL '7 days'
);

-- 2. Forçar recriação das notificações com horário correto
-- Isso será feito pela próxima execução dos cron jobs às 9h e 15h
-- Os cron jobs já estão configurados corretamente:
-- - 9h Brasil = 12h UTC (0 12 * * *)
-- - 15h Brasil = 18h UTC (0 18 * * *)

-- 3. Log da correção aplicada
INSERT INTO cron_execution_logs (job_name, status, details, created_at)
VALUES (
  'fix-billing-notifications-timezone',
  'completed',
  'Limpeza de notificações com horário incorreto aplicada. Edge Function corrigida para calcular timezone corretamente.',
  NOW()
);

-- 4. Comentário explicativo para futuras referências
COMMENT ON TABLE payment_notifications IS 'Tabela de notificações de pagamento. IMPORTANTE: Horários devem ser calculados considerando Brasil UTC-3. Para 9h Brasil usar 12h UTC, para 15h Brasil usar 18h UTC.';