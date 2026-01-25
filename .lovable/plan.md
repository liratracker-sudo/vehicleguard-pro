
# Plano: Cobranças Expiradas Permanecem Ativas

## Problema Atual

Quando um PIX expira no Mercado Pago, o webhook recebe o evento e:
1. Marca a transação como `status = 'cancelled'`
2. Define `cancellation_reason = 'expired'`
3. A cobrança vai para a aba "Canceladas" e para de ser cobrada

## Comportamento Desejado

Quando um PIX expira:
1. Manter a transação como `status = 'pending'`
2. Limpar o `external_id` antigo (PIX expirado)
3. Limpar dados de pagamento expirados (`pix_code`, `payment_url`)
4. A cobrança continua na aba principal sendo cobrada normalmente
5. Sistema continua enviando notificações de cobrança

```text
ANTES (comportamento atual):
┌─────────────────────────┐
│ PIX expira no MP        │
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ Webhook recebe evento   │
│ status = 'cancelled'    │
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ Cobrança cancelada      │
│ → Aba "Canceladas"      │
│ → PARA de cobrar        │
└─────────────────────────┘

DEPOIS (comportamento desejado):
┌─────────────────────────┐
│ PIX expira no MP        │
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ Webhook recebe evento   │
│ status = 'pending'      │
│ Limpa external_id/pix   │
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ Cobrança ativa          │
│ → Aba principal         │
│ → CONTINUA cobrando     │
└─────────────────────────┘
```

---

## Arquivo a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/mercadopago-webhook/index.ts` | Alterar lógica para PIX expirado |

---

## Implementação Técnica

### Modificar o case 'cancelled' no webhook

```typescript
// ANTES (linhas 132-155)
case 'rejected':
case 'cancelled':
  if (!isPaid) {
    newStatus = 'cancelled'
    if (paymentData.date_of_expiration) {
      const expirationDate = new Date(paymentData.date_of_expiration)
      if (expirationDate < new Date()) {
        cancellationReason = 'expired'  // ← Marca como cancelado
      }
    }
  }
  break

// DEPOIS
case 'rejected':
case 'cancelled':
  if (!isPaid) {
    // Verificar se expirou
    if (paymentData.date_of_expiration) {
      const expirationDate = new Date(paymentData.date_of_expiration)
      if (expirationDate < new Date()) {
        // PIX EXPIRADO: Manter como pending para continuar cobrando
        newStatus = 'pending'
        clearPaymentData = true  // Flag para limpar dados do PIX expirado
        console.log('PIX expirado - mantendo como pending para continuar cobrança')
      } else {
        // Cancelamento real pelo gateway (não expiração)
        newStatus = 'cancelled'
        cancellationReason = 'gateway'
      }
    } else {
      // Cancelamento/rejeição pelo gateway
      newStatus = 'cancelled'
      cancellationReason = 'gateway'
    }
  }
  break
```

### Limpar dados do PIX expirado

```typescript
// Adicionar flag antes do switch
let clearPaymentData = false

// No updateData, após o switch
if (clearPaymentData) {
  // Limpar dados do PIX expirado para que um novo possa ser gerado
  updateData.external_id = null
  updateData.pix_code = null
  updateData.payment_url = null
  updateData.barcode = null
}
```

---

## Fluxo Após Correção

1. Cliente recebe cobrança com link de PIX
2. PIX expira após 24h (cliente não pagou)
3. Mercado Pago envia webhook de expiração
4. Sistema **mantém cobrança como pending**
5. Sistema **limpa dados do PIX antigo**
6. Sistema continua enviando notificações
7. Cliente clica no link → gera **novo PIX válido**
8. Ciclo continua até pagamento ou cancelamento manual

---

## Resultado Esperado

| Situação | Antes | Depois |
|----------|-------|--------|
| PIX expira | Cobrança cancelada | Cobrança permanece ativa |
| Aba | "Canceladas" | Aba principal |
| Notificações | Param | Continuam |
| Cliente abre link | Vê PIX antigo expirado | Gera novo PIX |

---

## Considerações de Segurança

- Cancelamentos **manuais** (pelo gestor) continuam funcionando
- Cancelamentos por **rejeição do gateway** (cartão negado, etc) continuam cancelando
- Apenas **expiração** mantém a cobrança ativa
- Cobranças já **pagas** nunca são afetadas (proteção existente mantida)
