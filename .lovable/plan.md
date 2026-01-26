
# Plano: Corrigir Sanitização do APP_URL no Fallback

## Problema Identificado

Através da análise detalhada, identifiquei a **causa raiz** do problema:

1. A empresa **CLS PRIMER SOLUÇÕES** tem `domain = NULL` no banco de dados
2. Quando `domain = NULL`, o sistema usa o fallback `APP_URL` (variável de ambiente)
3. O segredo `APP_URL` está configurado como `https://app.liratracker.com.br/` **com trailing slash**
4. O código atual apenas sanitiza o domínio customizado, **mas NÃO sanitiza o APP_URL de fallback**

Resultado: 
```
baseUrl = "https://app.liratracker.com.br/"  (com trailing slash)
paymentLink = baseUrl + "/checkout/" + id
           = "https://app.liratracker.com.br//checkout/..."  ← BARRA DUPLA!
```

## Evidências

- Empresa CLS PRIMER: `domain = NULL`
- Links enviados: `https://app.liratracker.com.br//checkout/...` (barra dupla)
- O domínio `app.liratracker.com.br` é da empresa LIRA TRACKER (outra empresa), o que indica que está vindo do `APP_URL` de fallback

## Solução

Modificar **TODAS** as edge functions para sanitizar também o `APP_URL` de fallback, não apenas o domínio customizado.

### Antes (código atual)

```typescript
const appUrl = Deno.env.get('APP_URL') || 'https://vehicleguard-pro.lovable.app';
const sanitizedDomain = company?.domain 
  ? company.domain.replace(/^https?:\/+/i, '').replace(/\/+$/, '')
  : null;
const baseUrl = sanitizedDomain ? `https://${sanitizedDomain}` : appUrl;  // ← appUrl NÃO sanitizado!
const paymentLink = `${baseUrl}/checkout/${payment.id}`;
```

### Depois (correção)

```typescript
const rawAppUrl = Deno.env.get('APP_URL') || 'https://vehicleguard-pro.lovable.app';
// Sanitiza APP_URL: remove trailing slashes para evitar barra dupla no checkout
const appUrl = rawAppUrl.replace(/\/+$/, '');

const sanitizedDomain = company?.domain 
  ? company.domain.replace(/^https?:\/+/i, '').replace(/\/+$/, '')
  : null;
const baseUrl = sanitizedDomain ? `https://${sanitizedDomain}` : appUrl;  // ← appUrl agora sanitizado!
const paymentLink = `${baseUrl}/checkout/${payment.id}`;
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/billing-notifications/index.ts` | Sanitizar `appUrl` na linha 12 |
| `supabase/functions/ai-collection/index.ts` | Sanitizar `defaultAppUrl` na linha 94 |
| `supabase/functions/billing-management/index.ts` | Sanitizar `appUrl` na linha 155 |
| `supabase/functions/ai-manager-assistant/index.ts` | Verificar e sanitizar se aplicável |
| `supabase/functions/generate-next-charge/index.ts` | Verificar e sanitizar se aplicável |
| `supabase/functions/process-retroactive-charges/index.ts` | Verificar e sanitizar se aplicável |

## Etapas

1. Corrigir sanitização do `APP_URL` em todas as edge functions que geram URLs de checkout
2. Fazer deploy de todas as funções corrigidas
3. Executar SQL para corrigir URLs existentes com barra dupla (já feito anteriormente, mas pode haver novas)

## Por que as notificações anteriores falharam?

As notificações enviadas às 12:32 UTC foram ANTES das correções serem deployadas (14:55 UTC). Após o deploy, novas notificações devem funcionar corretamente.

## Resultado Esperado

- Todas as URLs de checkout geradas corretamente, independente de ter domínio customizado ou usar fallback
- Clientes conseguem acessar checkout sem erro 404
