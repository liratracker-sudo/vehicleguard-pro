# Alterar o valor de uma cobrança sem cancelar

Hoje só é possível mudar a data de vencimento. Para corrigir um valor é preciso cancelar a cobrança e criar outra. Vamos adicionar a edição de valor direto na lista de cobranças.

## Como vai funcionar

1. Na linha da cobrança, ao passar o mouse, aparece um novo ícone "Alterar valor" (ao lado de "Alterar vencimento").
2. A janela mostra o cliente, o valor atual e um campo para o novo valor, com um campo de motivo (opcional).
3. Se a cobrança estiver ligada a um contrato, a janela pergunta:
   - Aplicar somente nesta cobrança, ou
   - Aplicar também nas próximas (atualiza o valor mensal do contrato).
4. Disponível apenas para cobranças em aberto, vencidas ou protestadas. Cobranças pagas e canceladas continuam bloqueadas.
5. Após salvar, o link de pagamento continua o mesmo e passa a mostrar o valor novo.

## Cuidados com os meios de pagamento

- Cobranças criadas no Asaas são atualizadas no próprio Asaas com o novo valor.
- Um código PIX já gerado (Mercado Pago / PIX manual) não pode ter o valor alterado. Nesse caso o código antigo é descartado e um novo é gerado automaticamente quando o cliente abrir o link de pagamento. A janela avisa isso antes de confirmar.
- As mensagens de cobrança agendadas continuam válidas e passam a enviar o valor novo.

## Detalhes técnicos

- `supabase/functions/billing-management/index.ts`: nova ação `update_amount` — valida valor > 0, bloqueia status `paid`/`cancelled`, atualiza `amount` (e `late_fee`/`net_amount` se aplicável) em `payment_transactions`, limpa `pix_code`/`pix_qr_code`/`pix_expires_at` quando existirem, chama `asaas-integration` com `action: 'update_charge'` e `value` quando houver `external_id` (falha do gateway não derruba a operação, só loga), e atualiza `contracts.monthly_value` quando o usuário escolher "aplicar nas próximas". Registra a alteração via `audit_logs` (trigger existente em `payment_transactions` já cobre UPDATE).
- `src/hooks/useBillingManagement.ts`: `updateAmount(paymentId, { amount, reason, apply_to_contract })`.
- `src/components/billing/BillingActions.tsx`: ícone + diálogo com input de valor (usar `no-wheel` para travar a roda do mouse), aviso de regeneração de PIX e opção de aplicar ao contrato quando `payment.contract_id` existir.
- Nenhuma mudança de schema é necessária.
