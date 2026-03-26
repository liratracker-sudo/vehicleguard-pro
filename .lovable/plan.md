

# Plano: Otimizar performance da aplicação

## Problema

A aplicação trava no carregamento por múltiplas causas simultâneas:

1. **WhatsAppContext bloqueia tudo**: Chama edge function `whatsapp-evolution` (check_connection) no mount do app, antes de qualquer conteúdo renderizar. Se a edge function demora ou falha (WORKER_LIMIT), toda a aplicação fica travada nos skeletons.

2. **Dashboard faz 6 queries sequenciais**: O `useDashboardStats` executa um `for` loop com 6 queries de receita mensal uma após a outra (linhas 227-248), em vez de uma única query.

3. **Profile query duplicada 3x**: No mesmo hook, `profiles.select("company_id").single()` é chamada 3 vezes independentemente (stats, recentClients, monthlyRevenue).

4. **WhatsAppAlert polling a cada 30s**: Faz query adicional a cada 30 segundos com sua própria busca de profile.

## Solução

### 1. Lazy-load da verificação WhatsApp (maior impacto)

No `WhatsAppContext.tsx`, atrasar o `checkConnection()` em 5 segundos após o mount, para não bloquear o carregamento inicial da página.

```typescript
// Antes
useEffect(() => {
  checkConnection();
  ...
}, []);

// Depois  
useEffect(() => {
  const timer = setTimeout(() => checkConnection(), 5000);
  return () => clearTimeout(timer);
  ...
}, []);
```

### 2. Unificar query de receita mensal

No `useDashboardStats`, substituir o loop de 6 queries sequenciais por uma única query que busca todos os pagamentos dos últimos 6 meses e agrupa no JavaScript (mesmo padrão já usado no `useFinancialData.ts`).

### 3. Compartilhar company_id entre as 3 queries

Extrair `company_id` uma vez e reutilizar nas 3 queries do dashboard, ou unificar tudo em uma única `queryFn`.

### 4. Reduzir polling do WhatsAppAlert

Aumentar intervalo de `loadAlerts` de 30s para 120s.

## Arquivos a alterar

| Arquivo | Alteração |
|---------|-----------|
| `src/contexts/WhatsAppContext.tsx` | Delay de 5s no checkConnection inicial |
| `src/hooks/useDashboardStats.ts` | Unificar queries: 1 busca de profile, 1 query de 6 meses em vez de 6 sequenciais |
| `src/components/alerts/WhatsAppAlert.tsx` | Polling de 30s → 120s |

## Resultado esperado

- Dashboard carrega em 1-2s em vez de travar
- Redução de ~10 queries para ~4 no carregamento inicial
- Edge function do WhatsApp não bloqueia mais a renderização

