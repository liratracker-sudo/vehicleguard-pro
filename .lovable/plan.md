# Diagnóstico — Vencido do dashboard divergente da lista

## O que verifiquei no banco (LIRA TRACKER)

Consultando `payment_transactions` agora:

- `status = 'overdue'` (não protestado): **10 cobranças**, total **R$ 950,80**
- `status = 'pending'` com `due_date < hoje`: **0**
- Soma das 10 linhas visíveis na sua print da lista (THIAGO, FLAVIO, WILLIAN, YURI, CLAYTON, COSME, ALEXANDRO, MOISES, DIOGO, HUGO) = **R$ 950,80** — bate exatamente com o que existe no banco.

Ou seja: hoje, no banco, existem **10 cobranças vencidas somando R$ 950,80**.

O card do dashboard mostra **R$ 1.550,90 / 19 cobranças** — esse número **não corresponde a nenhum recorte atual** dos dados (nem incluindo protestadas, nem pending+pastdue, nem cancelled).

## Causa provável

O card "Vencido" é alimentado por `companyBalance` (edge function `billing-management → get_company_balance`). Esse valor está vindo de um snapshot/cache antigo (provavelmente da última vez que a página foi aberta antes de pagamentos serem confirmados/cancelados/baixados nas últimas horas).

A página `Billing.tsx` carrega `companyBalance` uma vez no mount e não revalida quando:
- Um pagamento é marcado como pago
- Uma cobrança é cancelada / baixada por perda
- O webhook do gateway atualiza status
- O cron diário roda e ajusta `status` para `overdue`

A lista (`payments`) é recarregada via realtime/refetch, mas o `companyBalance` fica estagnado — gerando exatamente esse tipo de divergência (card maior que a lista atual).

## Plano de correção

### 1. Forçar revalidação do `companyBalance`
Em `src/pages/Billing.tsx`:
- Recarregar `companyBalance` sempre que `payments` mudar (ou em paralelo ao `loadPayments`)
- Recarregar após qualquer ação que altere status: marcar pago, cancelar, dar baixa por perda, protestar, despromover protesto
- Adicionar botão de refresh manual no header "Ver Resumo Financeiro" (opcional)

### 2. Garantir consistência da fonte de verdade
Hoje o card usa `companyBalance.total_overdue` (server) com fallback para `payments.filter(status='overdue')` (client, limitado a 500 registros). Vou padronizar:
- Quando `companyBalance` carregar com sucesso, usar sempre o valor server-side
- Quando falhar/estiver carregando, mostrar skeleton em vez de fallback inconsistente
- Adicionar `staleTime` curto e `refetchOnWindowFocus` para evitar dados velhos

### 3. Verificar se há registros "fantasma" em outra empresa
Se após aplicar os itens 1 e 2 o card ainda mostrar 19/1.550,90, isso indica que você está logado em uma empresa diferente da LIRA TRACKER (que é a empresa dos clientes da print da lista). Nesse caso o problema é outro (ex.: cache de `company_id` no `getCompanyId()`), e eu trato em iteração separada.

## Detalhes técnicos

- `src/pages/Billing.tsx` (linhas ~66, 163-172): adicionar `loadCompanyBalance()` no mesmo `useEffect` que recarrega `payments`, e chamar em `onSuccess` das mutações
- `src/hooks/useBillingManagement.ts` (`getCompanyBalance`): manter assinatura, apenas garantir que retorna sempre dados frescos (sem cache em memória)
- Não vou alterar a lógica do edge function `get_company_balance` — ela já está correta (conta `status='overdue'` + `status='pending' AND due_date < hoje`, exclui protestadas)

## Resultado esperado

- Card "Vencido" passa a mostrar **R$ 950,80 / 10 cobranças** (valor real atual)
- Após qualquer baixa/pagamento/cancelamento, o card atualiza imediatamente
- Lista e card sempre coerentes entre si

## Fora de escopo

- Mudar a regra de negócio de "vencido" (continua sendo `status='overdue'` + `pending past-due`, sem protestadas)
- Recalcular histórico ou forçar reprocessamento do cron de status
