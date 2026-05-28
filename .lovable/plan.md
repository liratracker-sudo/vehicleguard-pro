## Objetivo

Tornar os indicadores financeiros confiáveis e auditáveis: ver exatamente quanto entrou em cada gateway (MercadoPago, Asaas, Inter, Gerencianet) e quanto saiu por categoria, dentro de qualquer período escolhido — com lista detalhada para conferir contra o extrato real.

## Problemas atuais identificados em `useFinancialData.ts`

1. **"Saldo por gateway" usa TODO o histórico** (linha 108-112: `allPaidPayments` sem filtro de data). Não dá pra conferir contra extrato mensal do MercadoPago/Asaas.
2. **Sem filtro de período** — sempre mostra mês corrente fixo.
3. **Sem comparação mês anterior** — não dá pra saber se está crescendo/caindo.
4. **Saídas não são quebradas por categoria** nos cards principais.
5. **Sem drill-down** — clicar num gateway não abre as transações que somaram o valor.
6. **Regime de caixa vs competência** misturado de forma confusa: receita mensal usa `due_date` (competência), mas o usuário quer "o que entrou na conta" → deve ser `paid_at` (caixa).

## Mudanças

### 1. Novo seletor de período no topo de `/financial`
- Presets: Hoje, Esta semana, **Este mês (padrão)**, Mês passado, Últimos 30 dias, Este ano, Personalizado.
- Personalizado abre date-range picker (shadcn Calendar).
- Estado controlado na página `Financial.tsx`, passado para o hook.

### 2. Refatorar `useFinancialData(period)`
- Aceita `{ from: Date, to: Date }`.
- Todas as queries de "entrou/saiu" passam a usar **`paid_at` (regime de caixa)** com o range escolhido — é o que reflete extrato bancário real.
- Mantém `due_date` apenas para o gráfico de tendência mensal (6 meses).
- `accountsByGateway` passa a respeitar o período (entradas por gateway **no período**), não mais saldo histórico.
- Adiciona `expensesByCategory: [{ category, amount, count }]` agregando `expenses` pagas no período via `expense_categories.name`.
- Adiciona `comparison`: mesmo período do mês anterior, calcula `revenueDelta%` e `expenseDelta%`.

### 3. UI da página `Financial.tsx` — novos blocos

**Cards de topo (KPIs):**
- Total Recebido no período + Δ% vs período anterior
- Total Pago no período + Δ%
- Saldo Líquido (entradas − saídas) + Δ%
- Ticket médio recebido

**Seção "Recebimentos por Gateway":**
- Um card por gateway (MercadoPago, Asaas, Inter, Gerencianet, Outros) com: valor total recebido no período, nº de transações, ticket médio, e barra de % do total.
- Cada card é clicável → abre `Sheet`/`Dialog` com tabela detalhada: data (`paid_at`), cliente, valor, status. Ordenada por data desc. Com totalizador no rodapé para conferência contra extrato.

**Seção "Saídas por Categoria":**
- Lista/cards por categoria de despesa com valor total e nº de despesas no período.
- Clicável → mesma `Sheet` com lista detalhada (data, descrição, valor).

**Gráfico de fluxo diário** mantido, mas respeitando o range escolhido (não mais fixo 30 dias).

**Gráfico mensal de tendência (6 meses)** mantido como referência (regime de competência).

### 4. Componente novo `TransactionDrilldownSheet`
- Recebe `title`, `transactions[]`, `total`.
- Tabela com filtro de busca, paginação simples, export CSV (botão).
- Reutilizado tanto para gateway quanto para categoria.

## Arquivos afetados

- `src/hooks/useFinancialData.ts` — refatorar para aceitar período + retornar `expensesByCategory`, `comparison`, gateways com detalhes
- `src/pages/Financial.tsx` — adicionar seletor de período, novos cards, novas seções
- `src/components/financial/PeriodSelector.tsx` — novo
- `src/components/financial/GatewayBreakdownCard.tsx` — novo
- `src/components/financial/ExpenseCategoryBreakdown.tsx` — novo
- `src/components/financial/TransactionDrilldownSheet.tsx` — novo

## Detalhes técnicos

- Nenhuma mudança de schema necessária — `payment_transactions.payment_gateway`, `payment_transactions.paid_at`, `expenses.paid_at` e `expense_categories` já existem.
- Memória `Finance: Accrual basis (due_date) for trends. Cash basis for Daily Flow.` será respeitada e expandida: KPIs de "entrou/saiu" passam explicitamente para regime de **caixa** (`paid_at`), o que casa com extrato bancário.
- Cache `react-query` invalida quando `period` muda (key inclui `from`/`to`).
- Export CSV usa `blob` client-side, sem dependências novas.