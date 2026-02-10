

# Plano: Corrigir Relatorios Financeiros - Calculo por Competencia

## Problema Identificado

Analisei os dados do banco e o codigo fonte. Existem **3 problemas criticos** nos calculos:

### 1. BillingHistory agrupa por `created_at` (ERRADO)
O grafico de historico de cobrancas (BillingHistory.tsx, linha 93) agrupa pagamentos pelo campo `created_at` (data de criacao do registro no sistema). Isso significa que uma cobranca criada em Janeiro com vencimento em Fevereiro aparece no mes de Janeiro -- o que distorce completamente os numeros.

### 2. useFinancialData usa `paid_at` (regime de caixa)
Os cards do Financeiro (Receita Mensal, etc.) filtram por `paid_at` -- ou seja, consideram apenas quando o dinheiro entrou. No regime de competencia, deveria usar `due_date` para receitas e despesas.

### 3. useReportData mistura criterios
Para pagamentos usa `paid_at`, para despesas usa `due_date` -- criterios inconsistentes no mesmo relatorio.

### Dados reais do Lira Tracker (Fevereiro 2026):
- Asaas: 1 pagamento recebido (R$ 244,27) com `paid_at` em fev, mas `due_date` em janeiro
- Asaas: 0 pagamentos com `due_date` em fevereiro (as 6 cobrancas que o usuario ve no Asaas provavelmente ainda estao com status pending/overdue e nao aparecem como "recebido")
- MercadoPago: 16 pagamentos recebidos em fev
- Manual: 8 pagamentos recebidos em fev
- Total recebido: R$ 2.173,01 (corresponde ao que aparece no card)

## Solucao

Mudar todos os relatorios para **regime de competencia** (`due_date`), que e o padrao contabil brasileiro.

### Arquivos a alterar:

| Arquivo | Alteracao Principal |
|---------|-------------------|
| `src/hooks/useFinancialData.ts` | Mudar filtros de `paid_at` para `due_date` nos cards e graficos mensais. Manter `paid_at` apenas para "Saldo Total" (caixa real) |
| `src/hooks/useReportData.ts` | Mudar filtros de pagamentos de `paid_at` para `due_date` para DRE, Fluxo de Caixa e Relatorio Mensal |
| `src/components/billing/BillingHistory.tsx` | Mudar agrupamento de `created_at` para `due_date`. Incluir `paid_at` na query para calcular corretamente received/pending/overdue |

### Detalhes Tecnicos

#### 1. `useFinancialData.ts`

**Receita Mensal (cards):**
- Antes: `eq('status', 'paid').gte('paid_at', monthStart)` 
- Depois: `gte('due_date', monthStartStr).lte('due_date', monthEndStr)` e agrupar por status no JS

**Graficos 6 meses:**
- Antes: filtra por `paid_at` e so mostra pagos
- Depois: filtra por `due_date`, mostra total faturado (todas as cobrancas do mes, nao so pagas)

**Saldo Total:**
- Mantido com `paid_at` + `status = paid` (representa dinheiro que realmente entrou no caixa)

**Receita Mensal no card:**
- Usar `due_date` no mes atual + `status = paid` (cobrancas do mes que foram pagas)

**Fluxo de Caixa diario:**
- Manter com `paid_at` pois representa movimento real de caixa

#### 2. `useReportData.ts`

**Pagamentos (DRE, Relatorio Mensal):**
- Antes: `gte('paid_at', monthStart.toISOString())`
- Depois: `gte('due_date', format(monthStart, 'yyyy-MM-dd')).lte('due_date', format(monthEnd, 'yyyy-MM-dd')).eq('status', 'paid')`

Isso garante que receitas e despesas usem o mesmo criterio (`due_date`).

#### 3. `BillingHistory.tsx`

**Query:**
- Antes: `select('amount, status, created_at, due_date, protested_at').gte('created_at', startDate)`
- Depois: `select('amount, status, due_date, paid_at, protested_at').gte('due_date', startDateStr)`

**Agrupamento:**
- Antes: `payment.created_at.substring(0, 7)` (linha 93)
- Depois: `payment.due_date.substring(0, 7)` -- agrupa pelo mes de competencia

Isso fara com que cobrancas aparecam no mes correto (vencimento), e o status refletira se foram pagas, pendentes ou vencidas.

### Resumo do impacto

- **Receita Mensal**: Mostrara cobrancas COM VENCIMENTO no mes atual que foram pagas
- **Graficos de historico**: Agruparao por mes de vencimento (competencia)
- **DRE e Relatorio Mensal**: Calculos consistentes por competencia
- **Saldo Total**: Permanece como caixa real (soma de tudo que foi pago)
- **Fluxo de Caixa diario**: Permanece por `paid_at` (movimento real)

