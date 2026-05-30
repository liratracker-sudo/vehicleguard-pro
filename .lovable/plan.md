## Objetivo

Permitir cobrar via **chave PIX direta** (sem API/gateway) com:
- Chave PIX única por empresa
- Valor com **desconto** se pago até o vencimento
- Valor com **acréscimo** se pago depois
- Confirmação manual pelo admin
- Exibida no checkout público apenas quando nenhum gateway estiver ativo

## 1. Banco de dados (migration)

Nova tabela `manual_pix_settings`:
- `company_id` (unique)
- `is_active` (bool)
- `pix_key`, `pix_key_type` (cpf/cnpj/email/phone/aleatoria)
- `beneficiary_name`
- `discount_type` ('percentage' | 'fixed'), `discount_value` (numérico)
- `surcharge_type` ('percentage' | 'fixed'), `surcharge_value`
- `instructions` (texto opcional exibido ao cliente)
- RLS: membros da empresa gerenciam; leitura pública apenas via RPC (não direta)
- GRANTs padrão (authenticated CRUD, service_role ALL)

Em `payment_transactions`, adicionar:
- `manual_pix_confirmed_at` (timestamp)
- `manual_pix_confirmed_by` (uuid, profile do admin)
- `manual_pix_proof_url` (text, opcional para futuro)

Atualizar `payment_gateway` para aceitar valor `'manual_pix'`.

## 2. RPC pública

`get_manual_pix_checkout(p_transaction_id uuid)` — SECURITY DEFINER:
- Retorna `{ enabled, pix_key, pix_key_type, beneficiary_name, instructions, amount_due, original_amount, discount_applied, surcharge_applied, is_overdue, due_date }`
- Calcula valor final baseado em `due_date` vs hoje (timezone BR) e config da empresa
- Só retorna `enabled=true` se a empresa **não tiver nenhum gateway ativo** (mercadopago/asaas/inter/gerencianet)

## 3. Configurações (Settings)

Nova aba/card **"PIX Manual"** em `src/components/settings/`:
- Toggle ativar
- Tipo + chave PIX
- Nome do beneficiário
- Desconto (%/R$) e acréscimo (%/R$)
- Instruções
- Hook `useManualPixSettings`

## 4. Checkout público

Em `src/pages/Checkout.tsx`:
- Chamar RPC `get_manual_pix_checkout` quando `availableGateways` estiver vazio
- Renderizar card com: chave (botão copiar), nome do beneficiário, valor exibido (com badge "desconto até DD/MM" ou "valor atualizado"), instruções
- Aviso: "Após o pagamento, envie o comprovante ao atendente."

## 5. Painel admin

Em `src/pages/Billing.tsx` / `BillingActions.tsx`:
- Novo botão **"Confirmar PIX manual"** quando `status='pending'|'overdue'` e empresa tem manual PIX habilitado
- Dialog: data do pagamento + valor recebido (pré-preenchido com valor calculado) + observação opcional
- Ao confirmar: edge function `billing-management` recebe nova action `confirm_manual_pix` → grava `paid_at`, `amount` (valor efetivo), `payment_gateway='manual_pix'`, campos de auditoria, e respeita o **Status Lock** (não regredir 'paid')

## 6. Relatórios financeiros

`useFinancialData.ts` e `GatewayBreakdownCard`:
- Incluir `'manual_pix'` na lista de gateways exibidos (rótulo "PIX Manual")

## 7. Arquivos

**Criar:**
- `supabase/migrations/<timestamp>_manual_pix.sql`
- `src/hooks/useManualPixSettings.ts`
- `src/components/settings/ManualPixSettings.tsx`
- `src/components/billing/ConfirmManualPixDialog.tsx`

**Editar:**
- `src/pages/Settings.tsx` (registrar nova aba/card)
- `src/pages/Checkout.tsx` (renderizar bloco PIX manual quando aplicável)
- `src/components/billing/BillingActions.tsx` (novo botão)
- `supabase/functions/billing-management/index.ts` (action `confirm_manual_pix`)
- `src/hooks/useBillingManagement.ts` (método `confirmManualPix`)
- `src/hooks/useFinancialData.ts` (label gateway)

## Fora de escopo (nesta entrega)

- Upload de comprovante pelo cliente
- Múltiplas chaves PIX
- Override por contrato
- Webhook/conciliação automática