

# Diagnostico: Notificações de cobrança não estão sendo enviadas

## Problema identificado

Existem **65 notificações travadas com status 'sending'** que nunca foram concluídas. Isso acontece porque:

1. O job marca notificações como `sending` antes de enviar (lock otimista)
2. Se o job sofre timeout ou erro, o cleanup marca o **cron_execution_logs** como `failed`
3. **MAS as notificações que já estavam em `sending` NUNCA são resetadas para `pending`**
4. Como a query busca apenas `status = 'pending'`, essas notificações ficam presas para sempre

Dados atuais confirmam:
- 65 notificações stuck em `sending` (desde 28/fev ate hoje)
- Jobs de 12:00, 12:30 e 13:00 de hoje falharam por timeout
- Jobs de 11:00 e 11:30 rodaram com sucesso mas enviaram **0 notificações** (porque as pendentes de hoje já estavam travadas como `sending`)

## Solução

### 1. Adicionar cleanup de notificações stuck no inicio de cada execução

No arquivo `supabase/functions/billing-notifications/index.ts`, adicionar uma função que reseta notificações com status `sending` há mais de 10 minutos de volta para `pending`. Isso será chamado no início do `processNotifications()`.

```typescript
// Antes do Step 1 em processNotifications():
async function resetStuckSendingNotifications() {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('payment_notifications')
    .update({ 
      status: 'pending', 
      updated_at: new Date().toISOString() 
    })
    .eq('status', 'sending')
    .lt('updated_at', tenMinutesAgo)
    .select('id');
  
  if (data?.length) {
    console.log(`🔓 Reset ${data.length} stuck 'sending' notifications back to 'pending'`);
  }
  return data?.length || 0;
}
```

### 2. Corrigir as 65 notificações travadas agora (SQL imediato)

Executar migration para resetar as notificações stuck existentes:

```sql
UPDATE payment_notifications 
SET status = 'pending', updated_at = now() 
WHERE status = 'sending';
```

### Arquivos a alterar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/billing-notifications/index.ts` | Adicionar `resetStuckSendingNotifications()` e chamar no início de `processNotifications()` |
| Migration SQL | Resetar as 65 notificações travadas em `sending` |

### Resultado esperado

- Notificações travadas serão automaticamente recuperadas a cada execução do cron
- As 65 notificações stuck serão imediatamente desbloqueadas
- Próxima execução do cron (dentro da janela 14h-16h Brasil) enviará as notificações pendentes

