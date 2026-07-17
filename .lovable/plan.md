# Fix: empresa sendo desativada automaticamente sem ação do usuário

## Causa raiz (confirmada nos logs)

O webhook `supabase/functions/asaas-webhook/index.ts` foi escrito assumindo que **todo pagamento no Asaas é uma mensalidade do SaaS** (assinatura da empresa na plataforma). Mas na sua aplicação o mesmo webhook/tabela `payment_transactions` recebe também **as cobranças que a empresa (LIRA TRACKER) emite para os clientes finais dela** via Asaas.

Fluxo do bug:
1. Um cliente final da LIRA TRACKER fica com boleto Asaas vencido há +15 dias.
2. Asaas dispara `PAYMENT_OVERDUE` no webhook.
3. `handlePaymentOverdue()` faz `SELECT ... FROM payment_transactions WHERE company_id = <LIRA> AND status='overdue' ORDER BY due_date ASC` — pega o mais antigo (que é do cliente final).
4. Como esse pagamento passou de 15 dias vencido, executa `UPDATE companies SET is_active=false WHERE id=<LIRA>`.

Ou seja: **qualquer cliente final inadimplente há +15 dias derruba a empresa toda.**

Os logs confirmam eventos `PAYMENT_OVERDUE` recorrentes chegando (07/16, etc.), e não há nenhuma entrada em `audit_logs` para a mudança em `companies` — bate exatamente com o `UPDATE` sendo feito pelo service_role dentro do webhook (sem trigger de auditoria em `companies`).

`handlePaymentConfirmation()` sofre do mesmo problema no sentido oposto: ao receber `PAYMENT_RECEIVED` de qualquer cliente final, reativa a empresa. Isso mascarou o problema em alguns momentos, mas o ciclo desativa/reativa continua.

## Correção

Remover a lógica de ativar/desativar empresa a partir do webhook Asaas de cobranças de clientes finais. O gate de assinatura do SaaS não deve depender de `payment_transactions` (que é multi-uso). A ativação/bloqueio por inadimplência da assinatura, se existir, precisa vir de uma fonte dedicada (`company_subscriptions` / `invoices`) — não deste webhook.

### Alterações em `supabase/functions/asaas-webhook/index.ts`

1. **Remover a chamada** a `handlePaymentOverdue(transaction)` no bloco de mudança para `overdue`.
2. **Remover a chamada** a `handlePaymentConfirmation(transaction)` no bloco de `paid`.
3. **Remover as funções** `handlePaymentOverdue` e `handlePaymentConfirmation` (não usadas em mais nenhum lugar).
4. Manter todo o resto (atualização de status da transação, logs, status lock de pagos, etc.).

### Reativar a empresa agora

`UPDATE companies SET is_active = true, updated_at = now() WHERE id = '3f86782c-a67f-498c-8913-d001dcba7dcf' AND is_active = false;` — só executa se estiver desativada no momento do fix (pelos dados atuais está `true`, então essa etapa vira no-op segura).

## O que NÃO muda

- Nenhuma outra edge function.
- Nenhuma tabela / RLS.
- Frontend intocado.
- Regras de status lock de pagamento continuam iguais.

## Efeito

- A partir do deploy, nenhum `PAYMENT_OVERDUE` do Asaas vai mais desativar a empresa.
- Se futuramente você quiser um bloqueio automático por inadimplência **da assinatura do SaaS**, criamos um fluxo separado ligado a `company_subscriptions` — posso planejar isso depois se você pedir.
