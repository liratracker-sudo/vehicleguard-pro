
# Plano: Regeneração Automática de PIX Expirado

## Problema Identificado
Quando o PIX expira no gateway (MercadoPago usa 24h por padrão), o webhook atualiza o status para `cancelled`. O cliente ao tentar pagar vê "Pagamento cancelado" sem opção de gerar novo PIX.

## Solução Proposta
Permitir que o checkout detecte pagamentos cancelados por expiração e ofereça a opção de regenerar uma nova cobrança automaticamente.

---

## Fase 1: Adicionar Campo para Identificar Motivo do Cancelamento

**Arquivo:** Nova migration SQL

Adicionar campo `cancellation_reason` na tabela `payment_transactions` para diferenciar:
- `expired` - PIX/boleto expirou automaticamente
- `manual` - Cancelado manualmente pelo usuário
- `gateway` - Cancelado pelo gateway por outro motivo

```sql
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

COMMENT ON COLUMN payment_transactions.cancellation_reason IS 
'Motivo do cancelamento: expired, manual, gateway';
```

---

## Fase 2: Atualizar Webhook do MercadoPago

**Arquivo:** `supabase/functions/mercadopago-webhook/index.ts`

Quando receber evento de pagamento cancelado/expirado, popular o campo `cancellation_reason`:

```typescript
// Ao processar evento de cancelamento
if (payment.status === 'cancelled' || payment.status === 'expired') {
  const reason = payment.status === 'expired' ? 'expired' : 
                 (payment.date_of_expiration ? 'expired' : 'gateway');
  
  await supabase
    .from('payment_transactions')
    .update({ 
      status: 'cancelled',
      cancellation_reason: reason
    })
    .eq('external_id', payment.external_reference);
}
```

---

## Fase 3: Modificar Lógica do Checkout

**Arquivo:** `src/pages/Checkout.tsx`

### 3.1 Detectar PIX Expirado (ao invés de bloquear)

Substituir o bloqueio simples por detecção inteligente:

```typescript
// Antes (bloqueio total):
if (paymentData.status === 'cancelled') {
  setPaymentResult({ success: false, error: 'Pagamento cancelado' });
  return;
}

// Depois (verificar motivo):
if (paymentData.status === 'cancelled') {
  // Se expirou ou tem external_id (indica que foi processado antes)
  const canRegenerate = paymentData.cancellation_reason === 'expired' || 
                        (paymentData.external_id && !paymentData.cancellation_reason);
  
  if (canRegenerate) {
    // Resetar status para pending e permitir nova geração
    setPayment({
      ...paymentData,
      status: 'pending',
      isExpiredPayment: true  // Flag para UI
    });
    // Continuar carregamento normal
  } else {
    // Cancelamento manual - bloquear
    setPaymentResult({ success: false, error: 'Pagamento cancelado' });
    return;
  }
}
```

### 3.2 Adicionar Estado para PIX Expirado

```typescript
const [isExpiredPayment, setIsExpiredPayment] = useState(false);
```

### 3.3 Exibir Aviso de Regeneração na UI

Adicionar banner informativo quando o pagamento expirou:

```tsx
{isExpiredPayment && (
  <Alert className="mb-4 border-amber-500 bg-amber-50">
    <AlertCircle className="h-4 w-4 text-amber-600" />
    <AlertTitle className="text-amber-800">PIX Expirado</AlertTitle>
    <AlertDescription className="text-amber-700">
      O código PIX anterior expirou. Selecione o método de pagamento 
      para gerar um novo código.
    </AlertDescription>
  </Alert>
)}
```

---

## Fase 4: Atualizar Edge Function `process-checkout`

**Arquivo:** `supabase/functions/process-checkout/index.ts`

### 4.1 Permitir Reprocessamento de Pagamentos Expirados

Remover bloqueio para pagamentos cancelados quando o motivo é expiração:

```typescript
// Antes:
if (payment.status === 'cancelled') {
  throw new Error('Pagamento cancelado');
}

// Depois:
if (payment.status === 'cancelled') {
  // Verificar se pode regenerar (expirado ou tem external_id indicando processamento anterior)
  const canRegenerate = payment.cancellation_reason === 'expired' || 
                        (payment.external_id && payment.cancellation_reason !== 'manual');
  
  if (!canRegenerate) {
    return new Response(
      JSON.stringify({ success: false, error: 'Pagamento cancelado manualmente' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  console.log('🔄 Regenerating expired payment:', payment.id);
}
```

### 4.2 Resetar Status ao Regenerar

Após gerar nova cobrança com sucesso, resetar o status:

```typescript
const updateData: any = {
  external_id: charge.id?.toString(),
  payment_url: charge.invoiceUrl || charge.invoice_url,
  pix_code: charge.pix_code || charge.pixCode,
  payment_gateway: gateway,
  status: 'pending',  // Resetar para pending
  cancellation_reason: null,  // Limpar motivo de cancelamento
  updated_at: new Date().toISOString()
};
```

---

## Fase 5: Atualizar Outros Webhooks

**Arquivos a verificar/atualizar:**
- `supabase/functions/asaas-webhook/index.ts`
- `supabase/functions/inter-webhook/index.ts`

Garantir que todos os webhooks populem `cancellation_reason` corretamente quando receberem eventos de expiração.

---

## Resumo dos Arquivos a Modificar

| Arquivo | Ação | Alterações |
|---------|------|------------|
| Nova migration SQL | CRIAR | Adicionar coluna `cancellation_reason` |
| `src/pages/Checkout.tsx` | MODIFICAR | Detectar expiração, mostrar aviso, permitir regeneração |
| `supabase/functions/process-checkout/index.ts` | MODIFICAR | Permitir reprocessamento de expirados |
| `supabase/functions/mercadopago-webhook/index.ts` | MODIFICAR | Popular `cancellation_reason` |
| `supabase/functions/asaas-webhook/index.ts` | VERIFICAR | Garantir consistência no tratamento |

---

## Fluxo Final

```text
                              ┌─────────────────┐
                              │ Cliente acessa  │
                              │ link de checkout│
                              └────────┬────────┘
                                       │
                                       ▼
                          ┌────────────────────────┐
                          │ Verificar status       │
                          │ do pagamento           │
                          └────────────┬───────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
       ┌──────────┐            ┌───────────────┐         ┌──────────┐
       │  PAID    │            │  CANCELLED    │         │ PENDING  │
       │          │            │               │         │          │
       └────┬─────┘            └───────┬───────┘         └────┬─────┘
            │                          │                      │
            ▼                          ▼                      ▼
    ┌───────────────┐     ┌─────────────────────────┐  ┌───────────────┐
    │ Mostrar       │     │ Verificar motivo:       │  │ Exibir form   │
    │ confirmação   │     │ - expired? → regenerar  │  │ de pagamento  │
    │ de pagamento  │     │ - manual? → bloquear    │  │               │
    └───────────────┘     └─────────────────────────┘  └───────────────┘
```

---

## Comportamento Esperado

| Cenário | Resultado |
|---------|-----------|
| PIX expirou (24h) | Mostra aviso + permite gerar novo PIX |
| Boleto expirou | Mostra aviso + permite gerar novo boleto |
| Cancelamento manual | Bloqueia com mensagem "Pagamento cancelado" |
| Pagamento pendente | Fluxo normal de checkout |
| Pagamento pago | Mostra confirmação de pagamento |

---

## Benefícios

1. **Melhor UX**: Cliente não precisa solicitar novo link
2. **Menos suporte**: Reduz chamados de "meu PIX não funciona"
3. **Auditoria**: Campo `cancellation_reason` permite rastrear motivos
4. **Flexibilidade**: Diferencia expiração automática de cancelamento manual
