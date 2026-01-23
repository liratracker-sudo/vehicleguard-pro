
# Correção: PIX Expirado Não Regenerando no Mercado Pago

## Problema Identificado

### Causa Raiz
A integração com Mercado Pago usa o `external_reference` (ID da transação) como `X-Idempotency-Key`. Isso causa um problema crítico:

1. PIX original criado com Idempotency-Key = `ee243a78-2854-4f84-9018-8a51546d0811`
2. Mercado Pago registra: "Este key = pagamento #142380341927"
3. PIX expira após 24h
4. Cliente tenta regenerar
5. Sistema envia novo request com **mesma** Idempotency-Key
6. Mercado Pago **retorna o pagamento antigo** (já expirado/cancelado)
7. Sistema mostra o PIX antigo que não funciona mais

### Evidência nos Logs
```
charge.id: 142380341927           // MESMO ID do original!
charge.status: "cancelled"         // Porque expirou
date_of_expiration: 2026-01-23T08:15:07  // Já passou!
```

---

## Solução

Modificar a função `mercadopago-integration` para usar um Idempotency-Key único a cada tentativa, adicionando um timestamp ou UUID:

```text
+---------------------------------------------+
|    ANTES (problemático)                      |
+---------------------------------------------+
| X-Idempotency-Key: payment_id               |
| Resultado: Mercado Pago retorna             |
| sempre o mesmo pagamento                    |
+---------------------------------------------+

             ⬇️

+---------------------------------------------+
|    DEPOIS (corrigido)                        |
+---------------------------------------------+
| X-Idempotency-Key: payment_id_timestamp     |
| Resultado: Cada tentativa cria              |
| um novo pagamento PIX                       |
+---------------------------------------------+
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/mercadopago-integration/index.ts` | Modificar geração do Idempotency-Key |

---

## Implementação Técnica

### Antes (linha 543)
```typescript
'X-Idempotency-Key': data.externalReference
```

### Depois
```typescript
// Gerar idempotency key único incluindo timestamp para permitir regeneração
const idempotencyKey = `${data.externalReference}_${Date.now()}`;
// ...
'X-Idempotency-Key': idempotencyKey
```

---

## Resultado Esperado

Após a correção:
1. Cada tentativa de gerar PIX criará um **novo pagamento** no Mercado Pago
2. PIX expirados poderão ser regenerados corretamente
3. Cliente receberá um QR Code/Chave PIX **nova e válida** por 24h
4. O pagamento funcionará normalmente no app do banco
