

# Detalhar cards financeiros na tela de Cobranças

## Problema

Os 4 cards atuais (Recebido, Pendente, Vencido, Saldo Devedor) somam **todos os pagamentos sem filtro de período**, misturando mês atual com meses futuros. O valor "Pendente" de R$ 6.138,30 inclui cobranças de maio em diante, confundindo o usuário.

## Solução

Reorganizar os cards em **6 cards** com separação clara entre mês atual e totais gerais:

```text
┌─────────────────┬──────────────────┬─────────────────┐
│  Recebido        │  A Receber       │   Vencido       │
│  (mês atual)     │  (mês atual)     │  (em atraso)    │
│  R$ 20.133,90    │  R$ 3.859,50     │  R$ 1.119,73    │
│  Abr/2025        │  até 30/04       │  10 cobranças   │
├─────────────────┼──────────────────┼─────────────────┤
│  Pendente Total  │  Próximos Meses  │  Saldo Devedor  │
│  (todos os meses)│  (mai em diante) │  (vencido+pend) │
│  R$ 6.138,30     │  R$ 2.278,80     │  R$ 7.258,03    │
│  todas pendentes │  futuro          │  total geral    │
└─────────────────┴──────────────────┴─────────────────┘
```

## Alterações técnicas

### 1. Edge function `billing-management` — action `get_company_balance`

Adicionar campos ao retorno calculando com filtro de data:
- `received_this_month`: pagos com `paid_at` no mês corrente
- `receivable_this_month`: pendentes/vencidos com `due_date` até fim do mês
- `pending_future`: pendentes com `due_date` após fim do mês

Manter os campos existentes para não quebrar nada.

### 2. `src/pages/Billing.tsx` — cards do resumo financeiro

- Grid de 3 colunas em 2 linhas (6 cards)
- Linha 1: **Recebido (Mês)**, **A Receber (Mês)**, **Vencido**
- Linha 2: **Pendente Total**, **Próximos Meses**, **Saldo Devedor**
- Cada card com subtítulo indicando o período (ex: "Abril/2025", "Mai em diante")

### 3. Interface `CompanyBalance` em `useBillingManagement.ts`

Adicionar os 3 novos campos opcionais ao tipo.

