
# Plano: Correção para Pagamentos Expirados Sem `cancellation_reason`

## Problema Identificado

O pagamento `4369aee1-3dc2-4859-8934-3383ac2e336d` está com:
- `status`: `cancelled`
- `cancellation_reason`: `null` (vazio)
- `external_id`: `142149780167` (existe)

A lógica atual no Checkout deveria permitir regeneração quando:
```typescript
canRegenerate = cancellationReason === 'expired' || 
                (paymentData.external_id && !cancellationReason);
```

No entanto, ainda está mostrando "Pagamento cancelado".

## Causa Raiz

Há duas possibilidades:

1. **Aplicação não publicada**: As mudanças que implementamos estão na preview, mas a URL de produção (`app.liratracker.com.br`) ainda está com o código antigo que bloqueia todos os pagamentos cancelados

2. **Bug de tipagem**: O TypeScript pode não estar reconhecendo `external_id` corretamente por causa do cast `(paymentData as any)` para `cancellation_reason`

---

## Solução Proposta

### Fase 1: Correção Imediata - Atualizar Transação no Banco

Marcar a transação específica com `cancellation_reason = 'expired'` para que funcione mesmo com o código atual:

```sql
UPDATE payment_transactions 
SET cancellation_reason = 'expired'
WHERE id = '4369aee1-3dc2-4859-8934-3383ac2e336d'
AND status = 'cancelled';
```

### Fase 2: Correção Permanente - Ajustar Lógica no Checkout

Modificar o Checkout.tsx para ser mais robusto:

```typescript
if (paymentData.status === 'cancelled') {
  // Verificar se pode regenerar:
  // 1. Se cancellation_reason é 'expired' OU
  // 2. Se tem external_id E cancellation_reason NÃO é 'manual'
  const cancellationReason = paymentData.cancellation_reason;
  const hasExternalId = !!paymentData.external_id;
  
  const canRegenerate = 
    cancellationReason === 'expired' || 
    (hasExternalId && cancellationReason !== 'manual');
  
  console.log('Cancellation check:', { 
    cancellationReason, 
    hasExternalId, 
    canRegenerate 
  });
  
  if (canRegenerate) {
    console.log('Payment expired or regenerable, allowing regeneration');
    setIsExpiredPayment(true);
  } else {
    console.log('Payment manually cancelled, blocking');
    setPaymentResult({ success: false, error: 'Pagamento cancelado' });
    return;
  }
}
```

A diferença é que agora verificamos `cancellation_reason !== 'manual'` em vez de `!cancellationReason`, permitindo que pagamentos com `cancellation_reason = null` também sejam regenerados (desde que tenham `external_id`).

### Fase 3: Publicar a Aplicação

Após as correções, será necessário publicar as mudanças para que a URL de produção (`app.liratracker.com.br`) receba as atualizações.

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Banco de dados | ATUALIZAR | Marcar transação específica como `expired` |
| `src/pages/Checkout.tsx` | MODIFICAR | Ajustar lógica para permitir regeneração quando `cancellation_reason` é `null` |

---

## Resultado Esperado

Após as correções:
1. O pagamento específico da cliente funcionará imediatamente
2. Novos pagamentos expirados serão automaticamente regeneráveis
3. Apenas pagamentos com `cancellation_reason = 'manual'` serão bloqueados
