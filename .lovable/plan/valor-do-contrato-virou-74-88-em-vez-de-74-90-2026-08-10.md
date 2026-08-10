# Valor do contrato virou 74,88 em vez de 74,90

## O que os dados mostram

Nenhum PIX de 74,88 foi gerado. A linha do tempo real:

- 05/08 17:41 — cobrança de agosto (venc. 15/08) criada com **R$ 74,90**.
- 05/08 17:43 — contrato editado e salvo com **74,88** (antes 147,80), conforme a auditoria.
- 10/08 11:33 — lembrete enviado no WhatsApp: **R$ 74,90** (cobrança de agosto).
- 10/08 12:42 — pagamento confirmado no Mercado Pago: **R$ 74,90**. É o print que você mandou.
- 10/08 12:42 — logo após a confirmação, o sistema gerou automaticamente a **próxima** cobrança (venc. 15/09) usando o `monthly_value` do contrato: **R$ 74,88**. Ela ainda não tem PIX gerado.

Ou seja, o valor cobrado e pago hoje foi 74,90 corretamente. O 74,88 que você viu é a cobrança do mês que vem, criada a partir do contrato — que está com 74,88 desde 05/08.


## Causa provável do 74,88

O campo "Valor Mensal" é um `<input type="number" step="0.01">`. Nesse tipo de campo, **girar a roda do mouse (ou setas do teclado) com o campo focado altera o valor de 1 centavo por vez**, sem o usuário perceber. Duas "rodadas" sobre o campo transformam 74,90 em 74,88 — exatamente a diferença observada.

Reforça a hipótese: na base inteira só existem 2 contratos com centavos "quebrados" (74,88 e 88,94); todos os outros terminam em valores redondos.

## Correção

1. **Dados**: corrigir o contrato do Daniel Resende para R$ 74,90 e a cobrança em aberto de 15/09 de 74,88 para 74,90 (ela não tem PIX gerado, então basta atualizar o valor). Verificar também o contrato com 88,94 e confirmar com você o valor correto antes de mexer.

2. **Bloquear a alteração por scroll/setas** em todos os campos numéricos do sistema: ao passar a roda do mouse sobre um campo numérico focado, o valor deixa de mudar (o comportamento padrão é desabilitado). Isso vale para contrato, cobrança avulsa, despesas, planos, PIX manual, regras de gateway, juros/multa, negociação, etc.

3. **Confirmação de valor no contrato**: quando o valor mensal digitado for diferente do sugerido pelo plano (preço × nº de veículos), mostrar um aviso claro no formulário com a diferença, para que uma digitação errada não passe despercebida.

## Detalhes técnicos

- Novo utilitário compartilhado (ex.: `src/lib/no-wheel.ts`) com um handler `onWheel` que faz `e.currentTarget.blur()`, aplicado a todos os `<Input type="number">` dos arquivos listados abaixo.
- Arquivos afetados: `ContractForm.tsx`, `PaymentForm.tsx`, `ExpenseForm.tsx`, `NegotiationDialog.tsx`, `ConfirmManualPixDialog.tsx`, `ManualPixSettings.tsx`, `LateFeeSettings.tsx`, `PaymentGatewayRules.tsx`, `Plans.tsx`, `Sellers.tsx`, `VehicleForm.tsx`, `BillingFilters.tsx`, `BillingNotificationsModal.tsx`, `CompanyLimitsDialog.tsx`, `SubscriptionPlansManagement.tsx`, `WhiteLabelConfig.tsx`, `PublicClientRegistration.tsx`.
- Aviso de divergência: comparação entre `formData.monthly_value` e `plan.price × vehicleCount` em `ContractForm.tsx`.
- Correção de dados via atualização em `contracts` e `payment_transactions` (nenhuma mudança de schema).
- Nada muda em `generate-next-charge` nem na integração Mercado Pago — o comportamento delas está correto.
