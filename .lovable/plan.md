
# Plano: Corrigir TODAS as Edge Functions que Geram URLs de Checkout

## Problema Confirmado

As URLs de checkout continuam sendo geradas com barra dupla (`//checkout/`). Identificamos:

1. **Edge functions anteriores precisam ser redeployadas** - as mudanças em `billing-notifications`, `ai-collection`, `ai-manager-assistant` e `billing-management` não estão ativas
2. **Duas edge functions NÃO foram corrigidas** - `generate-next-charge` e `process-retroactive-charges` usam apenas `APP_URL` e ignoram o domínio customizado da empresa

## Análise dos Dados do Banco

URLs com barra dupla criadas APÓS a correção anterior:
- `https://app.liratracker.com.br//checkout/5883511b...` (26/01 14:10)
- `https://app.liratracker.com.br//checkout/fd7a3ddc...` (25/01 16:48)

## Solução Completa

### Etapa 1: Corrigir `generate-next-charge/index.ts`

Adicionar busca do domínio da empresa e sanitização:

```typescript
// Buscar domínio da empresa
const { data: company } = await supabase
  .from('companies')
  .select('domain')
  .eq('id', payment.company_id)
  .single();

// Sanitizar e construir URL
const appUrl = Deno.env.get('APP_URL') || 'https://vehicleguard-pro.lovable.app';
const sanitizedDomain = company?.domain 
  ? company.domain.replace(/^https?:\/+/i, '').replace(/\/+$/, '')
  : null;
const baseUrl = sanitizedDomain ? `https://${sanitizedDomain}` : appUrl;
const checkoutUrl = `${baseUrl}/checkout/${newPayment.id}`;
```

### Etapa 2: Corrigir `process-retroactive-charges/index.ts`

Mesma lógica - buscar domínio da empresa para cada pagamento processado.

### Etapa 3: Fazer Deploy de TODAS as Edge Functions

Forçar deploy das seguintes funções:
- `billing-notifications`
- `ai-collection` 
- `ai-manager-assistant`
- `billing-management`
- `generate-next-charge`
- `process-retroactive-charges`

### Etapa 4: Corrigir URLs Existentes no Banco (novamente)

Executar SQL para corrigir as novas URLs com barra dupla:

```sql
UPDATE payment_transactions 
SET payment_url = REPLACE(payment_url, '//checkout/', '/checkout/'),
    updated_at = now()
WHERE payment_url LIKE '%//checkout/%';
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/generate-next-charge/index.ts` | Adicionar busca de domínio + sanitização |
| `supabase/functions/process-retroactive-charges/index.ts` | Adicionar busca de domínio + sanitização |

## Resultado Esperado

- TODAS as edge functions gerando URLs corretas
- URLs existentes corrigidas no banco
- Clientes acessam checkout sem erro 404
