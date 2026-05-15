# Alinhar "Vencido" entre Dashboard e Cobranças

## Causa raiz da divergência

Os dois cards usam regras diferentes para classificar uma cobrança como vencida:

**Dashboard** (`src/hooks/useDashboardStats.ts`, linhas 113-118):
```
status = 'overdue' AND protested_at IS NULL
```

**Cobranças** (`supabase/functions/billing-management/index.ts`, linhas 362-402, action `get_company_balance`):
```
(status = 'overdue')                                  -- linhas 393-399
OR (status = 'pending' AND due_date < today)          -- linhas 374-377
-- ambos com protested_at IS NULL (já filtrado na query)
```

Ou seja, a página Cobranças "promove" para Vencido também as `pending` cujo vencimento já passou mas que ainda não foram migradas para `overdue` pelo cron diário. O Dashboard ignora essas. Daí o card mostrar 18 / R$ 1.496,00 enquanto o Dashboard mostra um número menor.

A regra oficial do projeto (memory `Overdue Handling`) é: **usar sempre `status='overdue'`**. O cron é responsável por flipar `pending → overdue` no dia do vencimento.

## Mudança proposta

Em `supabase/functions/billing-management/index.ts`, action `get_company_balance` (lin 362-402):

1. Remover o ramo que joga `pending && due_date < today` em `total_overdue` / `overdue_count`.
2. Tratar essas cobranças como `pending` normais (entram em `total_pending`; entram em `receivable_this_month` se `due_date <= monthEnd`; em `pending_future` se `due_date > monthEnd`). Ou seja, o `case 'pending'` passa a usar apenas o caminho do `else` atual, sem checar `dueDate < today`.
3. `case 'overdue'` permanece como está (já alinhado com o Dashboard).

Resultado: card "Vencido" da página Cobranças passa a mostrar exatamente o mesmo conjunto que o Dashboard (`status='overdue'`, não protestadas). Qualquer pendente atrasada sem o cron ter rodado aparece em "Em aberto / A receber" — comportamento consistente com toda a plataforma.

## Não escopo

- Não mudar a regra do Dashboard.
- Não mexer no cron diário que faz `pending → overdue`.
- Não alterar a aba Protestos.
- Sem migration; só edge function.

## Arquivo a editar
- `supabase/functions/billing-management/index.ts` (apenas a função `get_company_balance`)
