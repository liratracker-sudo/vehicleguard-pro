

# Plano: Excluir cobranças protestadas dos cálculos financeiros

## Problema

Quando uma cobrança é marcada como "protestada" (campo `protested_at` preenchido), ela continua sendo contabilizada em:
- Cards do Dashboard (Vencido, Taxa de Inadimplência)
- Resumo Financeiro da tela de Cobranças (Vencido, Pendente, Saldo Devedor)
- Painel de Inadimplência Crítica (lista de 15+ dias)

Isso distorce os números financeiros, já que protestos são tratados separadamente na aba "Protestos".

## Solução

Adicionar filtro `protested_at IS NULL` em todas as queries que calculam métricas financeiras, para que cobranças protestadas sejam contabilizadas **apenas** na aba de Protestos.

## Arquivos a alterar

| Arquivo | O que muda |
|---------|-----------|
| `src/hooks/useDashboardStats.ts` | Adicionar `.is('protested_at', null)` nas queries de overdue (linha 116), upcoming (linha 124) e total payments (linha 130) |
| `supabase/functions/billing-management/index.ts` | Na action `get_company_balance`, adicionar `.is('protested_at', null)` na query (linha 337) |
| `src/components/billing/CriticalDelinquencyPanel.tsx` | Adicionar `.is('protested_at', null)` na query de pagamentos críticos (linha 119) |

## Detalhes Técnicos

### 1. `useDashboardStats.ts` - 3 queries afetadas

**Overdue payments** (calcula valor vencido e taxa de inadimplência):
```typescript
// Antes
.eq("status", "overdue")

// Depois
.eq("status", "overdue")
.is("protested_at", null)
```

**Upcoming payments** (próximos 7 dias):
```typescript
// Adicionar
.is("protested_at", null)
```

**Total payments** (base para taxa de inadimplência):
```typescript
// Adicionar
.is("protested_at", null)
```

### 2. `billing-management/index.ts` - Edge Function

Na query `get_company_balance`, adicionar filtro para excluir protestados:
```typescript
// Antes
.select('amount, status, due_date')
.eq('company_id', userCompanyId)

// Depois
.select('amount, status, due_date, protested_at')
.eq('company_id', userCompanyId)
.is('protested_at', null)
```

### 3. `CriticalDelinquencyPanel.tsx`

Na query de inadimplência crítica (15+ dias), excluir protestados:
```typescript
// Antes
.in('status', ['pending', 'overdue'])

// Depois
.in('status', ['pending', 'overdue'])
.is('protested_at', null)
```

## Resultado esperado

- Cobranças protestadas deixam de inflar os valores de "Vencido" e "Saldo Devedor"
- Taxa de inadimplência do Dashboard reflete apenas cobranças ativas (não protestadas)
- Painel de Inadimplência Crítica não exibe clientes já protestados
- Aba "Protestos" continua funcionando normalmente com seus próprios cálculos

