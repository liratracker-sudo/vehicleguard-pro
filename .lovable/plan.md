
## Por que o Supabase está reclamando

O aviso "exhausting multiple resources" é causado por **alto volume de queries repetitivas** sem índice ideal. As 5 piores responsáveis pelo gasto de CPU/IO são:

| # | Query (tabela) | Chamadas | Tempo total | Causa |
|---|---|---|---|---|
| 1 | UPDATE `whatsapp_sessions` por (company_id, instance_name) | 24.905 | **940s** | Polling do QR/Evolution salvando estado a cada poucos segundos |
| 2 | UPDATE `contracts` por `assinafy_document_id` | 27.598 | 242s | Webhook Assinafy — falta índice nessa coluna |
| 3 | SELECT `payment_notifications` por (payment_id, status) | 100.837 | 184s | Cron de notificações lê várias vezes por pagamento |
| 4 | SELECT `whatsapp_settings` por `instance_name` | 32.658 | 91s | Webhook Evolution resolvendo empresa por instância |
| 5 | SELECT `scheduled_reminders` por (status, scheduled_for) | 93.492 | 55s | Cron de lembretes roda muito frequente |

## Plano de ação (2 frentes)

### 1) Migration: índices que matam ~70% do custo

```sql
-- 1. whatsapp_sessions: UPDATE filtra por (company_id, instance_name)
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_company_instance
  ON public.whatsapp_sessions (company_id, instance_name);

-- 2. contracts: webhook Assinafy busca por assinafy_document_id
CREATE INDEX IF NOT EXISTS idx_contracts_assinafy_document_id
  ON public.contracts (assinafy_document_id)
  WHERE assinafy_document_id IS NOT NULL;

-- 3. payment_notifications: várias queries por payment_id + status/event_type
CREATE INDEX IF NOT EXISTS idx_payment_notifications_payment_status
  ON public.payment_notifications (payment_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_payment_event_status_sent
  ON public.payment_notifications (payment_id, event_type, status, sent_at DESC);

-- 4. whatsapp_settings: webhook resolve empresa por instance_name
CREATE INDEX IF NOT EXISTS idx_whatsapp_settings_instance_active
  ON public.whatsapp_settings (instance_name)
  WHERE is_active = true;

-- 5. scheduled_reminders: cron lê pendentes prontos para envio
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_status_scheduled
  ON public.scheduled_reminders (status, scheduled_for)
  WHERE status = 'pending';

-- 6. clients: lookup por telefone no webhook WhatsApp
CREATE INDEX IF NOT EXISTS idx_clients_company_phone
  ON public.clients (company_id, phone);

-- 7. payment_transactions: dashboard lista por company+status+due_date
CREATE INDEX IF NOT EXISTS idx_payment_transactions_company_status_due
  ON public.payment_transactions (company_id, status, due_date);
```

Tradeoff: leituras dessas queries caem de seq/bitmap scan para index scan (10–100x mais rápido); writes ficam marginalmente mais lentos (~5%) e ocupa ~poucos MB. Vale muito.

### 2) Reduzir frequência de polling (sem perder funcionalidade)

A query #1 (whatsapp_sessions UPDATE) chama 24 mil vezes — isso é polling do status WhatsApp. Vou:

- Aumentar intervalo de polling do `WhatsAppStatus` / `useWhatsAppSession` de ~5–10s para 30s quando o status já está `connected`, mantendo 5s só durante a fase de QR code.
- No cron de `scheduled_reminders` (#5), trocar leitura "todos pendentes" por leitura paginada (LIMIT 200) já filtrada por `scheduled_for <= now()`, evitando varrer a tabela inteira quando há fila grande.
- No webhook do MercadoPago/Assinafy, dedupe por evento já processado para evitar UPDATEs repetidos do mesmo documento (a query #2 fica em ~1/10).

Não vou mexer em nenhuma regra de negócio nem em UI; só intervalos de polling e o ORDER/LIMIT das leituras.

## Validação

Depois das mudanças, rodo `EXPLAIN ANALYZE` nas 3 queries piores para confirmar uso de index, e em 24h o banner do Supabase deve sumir conforme o `pg_stat_statements` reseta.

## O que não está incluído

- Não vou apagar logs antigos (`whatsapp_logs`, `ai_collection_logs`) nesta etapa. Se quiser, posso adicionar depois um cron de retenção (ex.: manter só 30 dias) — me avise.
- Não mexo no plano do Supabase — isso é decisão sua.

Posso seguir?
