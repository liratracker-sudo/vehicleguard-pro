

# Diagnóstico: Por que o cron de billing-notifications falha

## Causa raiz: Colisão de workers

O Supabase tem um limite de workers (compute resources) simultâneos. A cada execução do cron, **duas funções disparam no mesmo segundo exato**:

| Hora | `process-scheduled-reminders` | `billing-notifications` | Resultado |
|------|-------------------------------|------------------------|-----------|
| 12:00:00 | ✅ 200 (ganhou o worker) | ❌ 546 WORKER_LIMIT | billing falhou |
| 12:30:00 | ✅ 200 (ganhou o worker) | ❌ 546 WORKER_LIMIT | billing falhou |

O cron `process-scheduled-reminders` roda **a cada minuto** (`* * * * *`), então colide com `billing-notifications` nos minutos `:00` e `:30`. Como ambas tentam iniciar ao mesmo tempo, o Supabase rejeita a segunda por falta de workers.

Nos horários 11:00 e 11:30 de hoje, o billing rodou com sucesso (19s e 10s). Mas às 12:00 e 12:30, perdeu a disputa pelo worker.

## Estado atual (04/03)

- **19 pendentes**, **1 sending** (stuck), **16 enviadas**, **2 ignoradas**
- O job das 12:30 está registrado como `running` (nunca terminou)

## Solução

### 1. Deslocar o horário do billing-notifications para evitar colisão

Mudar o schedule de `0,30` para `2,32` (2 minutos de offset):

```sql
-- Remover crons antigos
SELECT cron.unschedule('process-billing-notifications');
SELECT cron.unschedule('process-billing-notifications-afternoon');

-- Recriar com horários deslocados
SELECT cron.schedule(
  'process-billing-notifications',
  '2,32 11,12,13,14 * * *',
  $$ SELECT net.http_post(...) $$
);

SELECT cron.schedule(
  'process-billing-notifications-afternoon', 
  '2 17,18,19 * * *',
  $$ SELECT net.http_post(...) $$
);
```

### 2. Adicionar timeouts nas chamadas externas na Edge Function

No `billing-notifications/index.ts`, envolver chamadas a `whatsapp-evolution` e `ai-collection` com `Promise.race` e timeout individual:

- `check_connection`: timeout 10s
- `ai-collection`: timeout 20s  
- `send_message`: timeout 30s

Se timeout: marcar notificação como `failed` com motivo, em vez de deixar em `sending`.

### 3. Recuperar as notificações stuck de hoje

O Step 0 (reset de `sending` > 10 min) já existe na função. Basta disparar uma execução manual agora, ou a próxima execução automática (14:02 UTC com o novo schedule) resolverá.

### Arquivos a alterar

| Recurso | Alteração |
|---------|-----------|
| Migration SQL (cron.schedule) | Offset de 2 min nos horários |
| `supabase/functions/billing-notifications/index.ts` | Timeouts individuais nas chamadas externas |

