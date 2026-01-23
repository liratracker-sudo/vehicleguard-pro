
# Plano: Corrigir URLs de Checkout com Domínio Customizado

## Problema Identificado

### 1. Barra Dupla no Checkout
A empresa **LIRA TRACKER** tem o domínio configurado como:
```
https://app.liratracker.com.br
```

Quando o código processa, ele faz:
```typescript
`https://${companyInfo.domain.replace(/^https?:+\/+/i, '')}`
```

**Resultado incorreto:**
- Input: `https://app.liratracker.com.br/`
- Regex remove `https://` mas deixa a barra final
- URL final: `https://app.liratracker.com.br//checkout/...` (barra dupla)

### 2. Referências Antigas ao Domínio
Ainda existem fallbacks com o domínio antigo `gestaotracker.lovable.app` em:
- `supabase/functions/ai-collection/index.ts` (linha 428)
- `supabase/functions/ai-manager-assistant/index.ts` (linha 850)

---

## Solução

### Fase 1: Corrigir a Função de Sanitização de Domínio

Criar uma função reutilizável que:
1. Remove o protocolo (`http://` ou `https://`)
2. Remove barras finais
3. Adiciona `https://` de forma consistente

```typescript
function sanitizeBaseUrl(domain: string | null, fallback: string): string {
  if (!domain) return fallback;
  
  // Remove protocol and trailing slashes
  const cleanDomain = domain
    .replace(/^https?:\/+/i, '')  // Remove http:// ou https://
    .replace(/\/+$/, '');          // Remove barras finais
  
  return `https://${cleanDomain}`;
}
```

### Fase 2: Atualizar Edge Functions

Aplicar a correção em todos os arquivos que constroem URLs de checkout:

| Arquivo | Linha(s) | Problema |
|---------|----------|----------|
| `supabase/functions/ai-collection/index.ts` | 95-98 | Regex incompleto |
| `supabase/functions/ai-collection/index.ts` | 428-432 | Fallback antigo + regex |
| `supabase/functions/billing-management/index.ts` | 156-159 | Regex incompleto |
| `supabase/functions/ai-manager-assistant/index.ts` | 107-110 | Regex incompleto |
| `supabase/functions/ai-manager-assistant/index.ts` | 850-854 | Fallback antigo + regex |

### Fase 3: Corrigir URLs Existentes no Banco

Executar SQL para corrigir as 3 transações com barra dupla:

```sql
UPDATE payment_transactions 
SET payment_url = REPLACE(payment_url, '//checkout/', '/checkout/'),
    updated_at = NOW()
WHERE payment_url LIKE '%//checkout/%'
AND status IN ('pending', 'overdue');
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/ai-collection/index.ts` | Corrigir regex e fallback antigo |
| `supabase/functions/billing-management/index.ts` | Corrigir regex |
| `supabase/functions/ai-manager-assistant/index.ts` | Corrigir regex e fallback antigo |
| Banco de dados | Atualizar URLs com barra dupla |

---

## Código Corrigido

Substituir em todos os arquivos:

```typescript
// ❌ ANTES (problemático)
const baseUrl = companyInfo?.domain 
  ? `https://${companyInfo.domain.replace(/^https?:+\/+/i, '')}` 
  : defaultAppUrl;

// ✅ DEPOIS (correto)
const defaultAppUrl = Deno.env.get('APP_URL') || 'https://vehicleguard-pro.lovable.app';
const baseUrl = companyInfo?.domain 
  ? `https://${companyInfo.domain.replace(/^https?:\/+/i, '').replace(/\/+$/, '')}` 
  : defaultAppUrl;
```

---

## Resultado Esperado

1. URLs geradas sem barra dupla
2. Domínio customizado funcionando: `https://app.liratracker.com.br/checkout/...`
3. Fallbacks atualizados para `vehicleguard-pro.lovable.app`
4. Transações existentes corrigidas
