
# Plano: Corrigir URL de Checkout

## Problema Identificado

A URL base do aplicativo está incorreta em dois lugares:

1. **Arquivo `.env`**: `VITE_APP_URL="https://gestaotracker.lovable.app"`
2. **Secret Supabase `APP_URL`**: Provavelmente também contém `gestaotracker.lovable.app`

A URL publicada real é `https://vehicleguard-pro.lovable.app`, fazendo com que os links de checkout gerados apontem para uma URL que não existe.

## Solução

### Fase 1: Corrigir a variável de ambiente `.env`

Alterar o valor de `VITE_APP_URL`:

```
VITE_APP_URL="https://vehicleguard-pro.lovable.app"
```

### Fase 2: Atualizar Secret no Supabase

Solicitar atualização do secret `APP_URL` para `https://vehicleguard-pro.lovable.app` (será necessária sua confirmação).

### Fase 3: Corrigir URLs Existentes no Banco

Atualizar todas as transações pendentes que têm a URL antiga:

```sql
UPDATE payment_transactions 
SET payment_url = REPLACE(payment_url, 'gestaotracker.lovable.app', 'vehicleguard-pro.lovable.app')
WHERE payment_url LIKE '%gestaotracker.lovable.app%'
AND status = 'pending';
```

### Fase 4: Atualizar Fallbacks nas Edge Functions

Substituir todas as referências hardcoded de `gestaotracker.lovable.app` por `vehicleguard-pro.lovable.app` como fallback nas edge functions:
- `supabase/functions/notify-admin-email/index.ts`
- `supabase/functions/send-reengagement-emails/index.ts`
- `supabase/functions/ai-manager-assistant/index.ts`
- `supabase/functions/billing-notifications/index.ts`
- `supabase/functions/billing-management/index.ts`
- `supabase/functions/update-payment-urls/index.ts`
- `supabase/functions/ai-collection/index.ts`
- `supabase/functions/generate-charges/index.ts`

## Resultado Esperado

Após as correções:
- Novas cobranças terão links corretos apontando para `vehicleguard-pro.lovable.app`
- Cobranças existentes serão atualizadas
- Clientes conseguirão acessar a página de checkout
