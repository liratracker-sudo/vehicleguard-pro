-- 1. Gerar post_due faltantes para clientes vencidos (LIRA TRACKER e demais)
-- Para cada payment overdue, insere uma row para cada offset_days <= dias atrasados
-- que ainda não exista, respeitando o unique constraint
WITH overdue_payments AS (
  SELECT 
    p.id AS payment_id,
    p.company_id,
    p.client_id,
    GREATEST(0, (CURRENT_DATE - p.due_date::date))::int AS days_past_due,
    s.post_due_days,
    s.send_hour
  FROM payment_transactions p
  JOIN payment_notification_settings s ON s.company_id = p.company_id
  WHERE p.status IN ('overdue','pending')
    AND p.due_date::date < CURRENT_DATE
    AND s.active = true
),
expanded AS (
  SELECT 
    op.payment_id,
    op.company_id,
    op.client_id,
    op.send_hour,
    unnest(op.post_due_days)::int AS target_days,
    op.days_past_due
  FROM overdue_payments op
),
to_create AS (
  SELECT e.*
  FROM expanded e
  WHERE e.days_past_due >= e.target_days
    AND NOT EXISTS (
      SELECT 1 FROM payment_notifications n
      WHERE n.payment_id = e.payment_id
        AND n.event_type = 'post_due'
        AND n.offset_days = e.target_days
    )
),
numbered AS (
  SELECT 
    tc.*,
    ROW_NUMBER() OVER (PARTITION BY tc.company_id ORDER BY tc.payment_id, tc.target_days) AS rn
  FROM to_create tc
)
INSERT INTO payment_notifications (
  company_id, payment_id, client_id, event_type, offset_days, scheduled_for, status, attempts
)
SELECT 
  company_id,
  payment_id,
  client_id,
  'post_due',
  target_days,
  -- Hoje no send_hour configurado + jitter de ~7s entre cada uma para anti-ban
  ((CURRENT_DATE::timestamp + send_hour::time) AT TIME ZONE 'America/Sao_Paulo')
    + (rn * interval '7 seconds'),
  'pending',
  0
FROM numbered
ON CONFLICT (company_id, payment_id, event_type, offset_days) DO NOTHING;

-- 2. Resetar notificações failed recentes da CLS PRIMER (e qualquer outra) para serem reprocessadas
UPDATE payment_notifications
SET status = 'pending',
    attempts = 0,
    last_error = NULL,
    scheduled_for = NOW() + interval '5 minutes'
WHERE status = 'failed'
  AND event_type = 'post_due'
  AND scheduled_for >= CURRENT_DATE - interval '1 day';