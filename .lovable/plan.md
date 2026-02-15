
# Corrigir baixa automatica de pagamentos Mercado Pago

## Problema confirmado

Ao criar o PIX para o cliente RODRIGO ARANTES PIRES no Mercado Pago, o campo `notification_url` foi enviado como `null`. Por isso, quando o pagamento foi feito (por ANGELA MARIA ARANTES MOTTA via PIX - R$ 69,21), o Mercado Pago nao enviou o webhook de confirmacao e o sistema nao deu baixa automatica.

A baixa que aparece no sistema foi feita pelo **Asaas** (que tambem tinha uma cobranca para o mesmo cliente), nao pelo Mercado Pago.

## Solucao

Adicionar `notification_url` apontando para a edge function `mercadopago-webhook` em dois pontos do arquivo `supabase/functions/mercadopago-integration/index.ts`:

## Alteracoes

### 1. Pagamento PIX direto (linha 584)

Adicionar `notification_url` no objeto `paymentData`:

```typescript
const paymentData: any = {
  transaction_amount: Number(data.value),
  description: data.description || 'Pagamento',
  payment_method_id: 'pix',
  payer: { ... },
  external_reference: data.externalReference,
  date_of_expiration: expirationISO,
  notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`
}
```

### 2. Checkout Preferences - boleto/cartao (linha 674)

Adicionar `notification_url` no objeto `preferenceData`:

```typescript
const preferenceData: any = {
  items: [...],
  payer: { ... },
  external_reference: data.externalReference,
  notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
  payment_methods: { ... },
  date_of_expiration: ...
}
```

### Deploy

Apos as alteracoes, a edge function `mercadopago-integration` sera redeployada.

## Fluxo corrigido

1. Sistema cria pagamento PIX no MP **com notification_url**
2. Cliente paga o PIX (mesmo de conta de terceiro)
3. Mercado Pago envia webhook para `mercadopago-webhook`
4. Webhook busca transacao pelo `external_id`, atualiza status para `paid`
5. Trigger `notify_payment_confirmed` dispara notificacao automatica

## Resultado esperado

Todos os pagamentos futuros via Mercado Pago (PIX, boleto, cartao) terao baixa automatica, independente de quem paga.
