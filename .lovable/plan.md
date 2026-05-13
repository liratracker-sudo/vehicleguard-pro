
# Fix: erro ao dar baixa por perda em cliente protestado

## Causa raiz

Em `src/components/billing/ProtestedPaymentsTab.tsx`, a função `handleWriteOff` (linhas 217–241) faz um `update` direto em `payment_transactions` setando:

```ts
{ status: 'cancelled', notes: `Baixa por perda - ...` }
```

A coluna **`notes` não existe** em `payment_transactions`. Colunas reais relacionadas a cancelamento: `cancellation_reason`, `cancelled_at`, `cancelled_by`. O PostgREST devolve erro `42703 column "notes" does not exist` e o `catch` exibe o toast genérico "Erro ao dar baixa" sem detalhes.

Confirmado consultando o schema atual e as policies/triggers da tabela — RLS está correto, o problema é puramente o nome da coluna inexistente.

## Correção

Substituir o `update` direto pelo edge function já existente `billing-management` com `action: 'delete_payment'`, que:
- Marca como `cancelled` (soft-delete, conforme memória do projeto)
- Preenche `cancellation_reason`, `cancelled_at`, `cancelled_by`
- Mantém auditoria coerente

### Mudança em `ProtestedPaymentsTab.tsx`

1. Expandir o destructuring de `useBillingManagement()` para incluir `deletePayment`.
2. Reescrever `handleWriteOff` para chamar `deletePayment(payment.id, "Baixa por perda | Protestado em <data>")` e recarregar a lista. O toast de sucesso/erro já é tratado pelo hook.

## Resultado esperado

- Botão "Dar baixa por perda" funciona
- Pagamento sai da lista de protestos com `status='cancelled'`
- `cancellation_reason` preenchido com a motivação
- Toast de sucesso exibido normalmente

## Fora do escopo

- Outras ações da aba Protestos
- Adicionar coluna `notes` ao schema (desnecessário; `cancellation_reason` já cobre)
