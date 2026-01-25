
# Plano: Corrigir URLs de Checkout com Barra Dupla

## Problema Identificado

URLs de checkout para a empresa LIRA TRACKER estão sendo geradas com barra dupla:
- **Errado**: `https://app.liratracker.com.br//checkout/...`
- **Correto**: `https://app.liratracker.com.br/checkout/...`

O domínio no banco está como `https://app.liratracker.com.br`, e a sanitização não está removendo corretamente o protocolo antes de reconstruir a URL.

## Solução

### 1. Criar Função Utilitária de Sanitização Consistente

Padronizar a sanitização de domínio em todas as edge functions:

```typescript
function sanitizeDomain(domain: string, fallbackUrl: string): string {
  if (!domain) return fallbackUrl;
  
  // Remove protocolo e trailing slashes
  const cleanDomain = domain
    .replace(/^https?:\/+/i, '')  // Remove http:// ou https://
    .replace(/\/+$/, '');          // Remove trailing slashes
  
  return `https://${cleanDomain}`;
}
```

### 2. Arquivos a Modificar

| Arquivo | Problema |
|---------|----------|
| `supabase/functions/billing-notifications/index.ts` | Regex incorreta e falta remoção de trailing slash |
| `supabase/functions/ai-collection/index.ts` | Verificar consistência |
| `supabase/functions/ai-manager-assistant/index.ts` | Verificar consistência |
| `supabase/functions/billing-management/index.ts` | Verificar consistência |

### 3. Corrigir URLs Existentes no Banco

Executar SQL para corrigir URLs com barra dupla:

```sql
UPDATE payment_transactions 
SET payment_url = REPLACE(payment_url, '//checkout/', '/checkout/')
WHERE payment_url LIKE '%//checkout/%';
```

## Resultado Esperado

- Novas cobranças geradas com URLs corretas
- URLs existentes corrigidas no banco
- Clientes conseguem acessar o checkout sem erro 404
