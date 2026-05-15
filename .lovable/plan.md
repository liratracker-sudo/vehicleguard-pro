## Problema

- Card "Recebido (mai de 2026)" no Billing: **R$ 3.052,12** — usa `paid_at` (regime de caixa) em `billing-management/get_company_balance`.
- Relatório Fluxo de Caixa (mai/2026) — Total Entradas: **R$ 2.453,01** — usa `due_date` (regime de competência) em `useReportData.ts`.

Pela regra do projeto ("Accrual basis para tendências, Cash basis para Daily Flow"), o **Fluxo de Caixa deve ser regime de caixa** (data de recebimento), então o card está certo e o relatório está errado.

## Correção

Em `src/hooks/useReportData.ts`:

1. **Cash Flow (entradas do mês)** — trocar filtro de `due_date` para `paid_at` no fetch `currentPayments` e `prevPayments`. Estas variáveis alimentam `cashFlowData.inflows/totalInflows/periodBalance` e `monthlyReport`.

2. **Saldo acumulado** — manter como está (soma de todos `paid` menos despesas pagas).

3. **DRE** permanece por competência? Hoje DRE também usa `currentPayments` (mesmo fetch). Como o card "Recebido" e o Fluxo são caixa, e o usuário só reportou divergência no Fluxo de Caixa, vou:
   - Renomear o fetch atual para `currentPaymentsCash` (filtrado por `paid_at`) e usá-lo em Cash Flow + Monthly Report.
   - Manter DRE coerente: como hoje DRE = Fluxo no código, ele passa a ser caixa também (consistente com `received_this_month` do dashboard/billing).

## Arquivo afetado

- `src/hooks/useReportData.ts` — apenas as duas queries de `payment_transactions` com `status='paid'` (current e previous month) trocam `.gte/.lte('due_date', ...)` por `.gte/.lte('paid_at', ...)` (com cast ISO completo do início/fim do mês).

## Fora de escopo

- `billing-management` (já correto).
- Dashboard (`useDashboardStats`).
- Despesas (continuam por `due_date` para pagas, comportamento atual).
- Relatório de Inadimplência / Protestos.

## Validação

Após a mudança, em mai/2026: `Total Entradas` do Fluxo de Caixa deve bater com `Recebido (mai de 2026)` = R$ 3.052,12.
