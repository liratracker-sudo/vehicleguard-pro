

# Diagnóstico: Notificações de cobrança paradas há dias

## Problema encontrado

Analisei os logs do cron e do banco de dados. O problema é claro:

**Todas as execuções do cron retornam `"sent":0, "failed":1`** — todas as notificações estão falhando com o erro:
> "WhatsApp desconectado - reconecte para retomar envios"

Isso acontece porque antes de enviar qualquer notificação, o sistema chama `checkConnection` na edge function `whatsapp-evolution` (com timeout de 10s). Essa chamada está falhando ou retornando "desconectado", o que ativa o **circuit breaker** que **para todo o processamento da empresa**.

Porém, o WhatsApp **ESTÁ conectado** — os logs mostram mensagens sendo enviadas com sucesso agora mesmo (confirmações de pagamento, cobranças manuais).

**Causa raiz**: A chamada `supabase.functions.invoke('whatsapp-evolution', { checkConnection })` dentro da `billing-notifications` provavelmente está dando timeout (WORKER_LIMIT) quando executada pelo cron, porque as edge functions compartilham workers e o cron dispara várias ao mesmo tempo.

Além disso, há **31 notificações pendentes** acumuladas desde 24 de março que nunca foram processadas, e **67 notificações marcadas como "failed"** nos últimos 7 dias.

## Solução proposta

### 1. Remover a verificação de conexão bloqueante

Em vez de verificar conexão antes de cada envio (o que causa WORKER_LIMIT e timeout), o sistema deve **tentar enviar diretamente** e tratar o erro se falhar. O `sendText` da Evolution API já retorna erro se a instância estiver desconectada.

### 2. Ajustar o circuit breaker

Manter o circuit breaker, mas ativá-lo apenas quando o **envio real** falhar com erro de conexão (não em um check prévio).

### 3. Reprocessar notificações travadas

Converter as 67 notificações `failed` com erro "WhatsApp desconectado" de volta para `pending`, e as 31 notificações pendentes antigas que nunca foram tentadas.

## Alterações técnicas

### `supabase/functions/billing-notifications/index.ts`

1. **Remover** a função `checkWhatsAppConnectionCached` e sua chamada em `sendSingleNotification` (linhas 1272-1291)
2. **Manter** o circuit breaker no catch do `sendSingleNotification` (linhas 734-757), mas detectar erro de conexão a partir da resposta do `sendText` real
3. Atualizar `sendSingleNotification` para capturar erros de envio que indiquem desconexão do WhatsApp e lançar circuit breaker nesses casos

### Migração SQL

Reprocessar notificações travadas:
```sql
UPDATE payment_notifications 
SET status = 'pending', attempts = 0, last_error = NULL 
WHERE status = 'failed' 
AND last_error ILIKE '%WhatsApp desconectado%'
AND scheduled_for >= now() - interval '14 days';
```

## Resultado esperado

- Notificações voltam a ser enviadas imediatamente na próxima execução do cron
- Sem dependência de uma chamada extra de `checkConnection` que consome workers
- Circuit breaker continua protegendo contra envios repetidos quando WhatsApp realmente estiver fora
- ~67 notificações falhadas serão reprocessadas

