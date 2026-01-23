
# Plano: Corrigir URLs de Checkout nas Edge Functions

## Problemas Identificados

### 1. Inversão de URLs no Banco
Quando executamos a função `update-payment-urls`, ela ainda estava usando o secret `APP_URL` antigo, causando uma inversão:
- URLs corretas (`vehicleguard-pro`) foram trocadas para incorretas (`gestaotracker`)
- Logs mostram: `vehicleguard-pro.lovable.app -> gestaotracker.lovable.app`

### 2. Edge Functions com URLs Relativas
Duas edge functions estão gerando URLs sem o domínio:

**generate-next-charge/index.ts (linha 195):**
```typescript
const checkoutUrl = `/checkout/${newPayment.id}`;  // Sem domínio!
```

**process-retroactive-charges/index.ts (linha 140):**
```typescript
const checkoutUrl = `/checkout/${newPayment.id}`;  // Sem domínio!
```

---

## Solução

### Fase 1: Corrigir as Edge Functions

Adicionar o domínio completo nas URLs geradas:

**generate-next-charge/index.ts:**
```typescript
const appUrl = Deno.env.get('APP_URL') || 'https://vehicleguard-pro.lovable.app';
const checkoutUrl = `${appUrl}/checkout/${newPayment.id}`;
```

**process-retroactive-charges/index.ts:**
```typescript
const appUrl = Deno.env.get('APP_URL') || 'https://vehicleguard-pro.lovable.app';
const checkoutUrl = `${appUrl}/checkout/${newPayment.id}`;
```

### Fase 2: Re-executar Correção do Banco

Executar query SQL diretamente para corrigir todas as URLs pendentes:

```sql
UPDATE payment_transactions 
SET payment_url = REPLACE(
  payment_url, 
  'gestaotracker.lovable.app', 
  'vehicleguard-pro.lovable.app'
),
updated_at = NOW()
WHERE payment_url LIKE '%gestaotracker.lovable.app%'
AND status IN ('pending', 'overdue');
```

### Fase 3: Corrigir URLs Relativas (sem domínio)

```sql
UPDATE payment_transactions 
SET payment_url = CONCAT(
  'https://vehicleguard-pro.lovable.app', 
  payment_url
),
updated_at = NOW()
WHERE payment_url LIKE '/checkout/%'
AND status IN ('pending', 'overdue');
```

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/generate-next-charge/index.ts` | MODIFICAR | Adicionar APP_URL no início do checkoutUrl |
| `supabase/functions/process-retroactive-charges/index.ts` | MODIFICAR | Adicionar APP_URL no início do checkoutUrl |
| Banco de dados | ATUALIZAR | Corrigir URLs existentes via SQL |

---

## Resultado Esperado

Após as correções:
1. Cobranças existentes terão URLs funcionando (`vehicleguard-pro.lovable.app`)
2. Novas cobranças geradas automaticamente terão URLs completas
3. A transação de teste (`13342709-e7b5-440b-bacf-1525eca9c30e`) funcionará corretamente
