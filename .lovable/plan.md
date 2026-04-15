

# Fix: Notificações de cobrança vencida não são criadas

## Problema identificado

O sistema cria notificações `pre_due` (antes do vencimento) e `on_due` (no dia) normalmente, mas **não consegue criar novas notificações `post_due`** para cobranças já vencidas.

**Causa raiz**: Bug na lógica de `createNotificationsForCompany` (linha 1657):

1. A query de notificações existentes filtra apenas `status = 'pending'`
2. Para cobranças vencidas (ex: COSME, 5d atraso), o sistema tenta criar `post_due` com `offset_days=1`
3. Porém já existe uma notificação `offset_days=1` com status `sent` no banco
4. O `upsert` com `ignoreDuplicates: true` rejeita silenciosamente a inserção
5. A variável `notificationCreated = true` faz o loop parar, então dias 2-5 nunca são tentados
6. Na próxima execução, o ciclo se repete indefinidamente

**Dados confirmados**:
- COSME (5d atraso): tem `post_due offset_days=1` como `sent`, nenhum `pending` — sistema trava tentando criar dia 1
- CLAYTON (36d atraso): mesmo padrão
- 73 cobranças vencidas da LIRA TRACKER sem nenhuma notificação `post_due` pendente

## Solução

Alterar a query de notificações existentes em `createNotificationsForCompany` para incluir **todos os status** (`sent`, `failed`, `skipped`) além de `pending`, evitando que o sistema tente recriar notificações já enviadas.

### Alteração em `supabase/functions/billing-notifications/index.ts`

**Linha 1657-1661**: Mudar a query `existingNotifications` de:
```typescript
.eq('status', 'pending')  // ← BUG: ignora sent/failed
```
Para:
```typescript
.in('status', ['pending', 'sent', 'failed', 'skipped'])  // ← Considera TODOS os status
```

Isso faz o sistema reconhecer que `offset_days=1` já foi enviado, pular para `offset_days=2`, e criar a próxima notificação corretamente.

### Ação complementar no banco

Executar SQL para resetar as 204 notificações `post_due` falhadas por "WhatsApp desconectado" que ficaram presas desde antes da reconexão:

```sql
UPDATE payment_notifications 
SET status = 'pending', attempts = 0, last_error = NULL 
WHERE status = 'failed' 
AND event_type = 'post_due'
AND last_error ILIKE '%WhatsApp desconectado%';
```

## Resultado esperado

- Cobranças vencidas passarão a receber notificações progressivas (dia 1, 2, 3... até 18)
- O cron não ficará mais preso tentando criar a mesma notificação repetidamente
- As 204 notificações travadas serão reprocessadas

