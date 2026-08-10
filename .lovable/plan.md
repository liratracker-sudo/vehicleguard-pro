# Divergência de valor: cobrança 74,90 x PIX 74,88 (Daniel Resende)

## O que os dados mostram

Não houve arredondamento nem erro na geração do PIX. Os valores conferidos no banco:

- Cobrança paga em 10/08 (vencimento 15/08): **R$ 74,90** — paga via Mercado Pago, valor correto.
- Nova cobrança gerada em 10/08 (vencimento 15/09): **R$ 74,88** — ainda sem PIX gerado.
- O contrato do cliente está com `monthly_value` = **74,88**.
- O log de auditoria registra uma edição manual do contrato em **05/08/2026 17:43**, alterando o valor de 147,80 para **74,88** (feita por um usuário do sistema, provavelmente erro de digitação: 74,88 em vez de 74,90).

A geração da próxima cobrança usa o `monthly_value` do contrato como fonte da verdade, então ela apenas copiou o 74,88 digitado. O PIX, quando gerado, usa exatamente o valor da cobrança — sem conversão ou perda de centavos.

## Correção pontual

1. Corrigir o `monthly_value` do contrato do Daniel Resende para **74,90**.
2. Corrigir a cobrança em aberto (venc. 15/09) de 74,88 para **74,90**. Como ela ainda não tem PIX gerado, basta atualizar o valor — nada precisa ser cancelado no gateway.

## Prevenção (evitar novos erros de digitação)

No formulário de contrato (campo "Valor Mensal"):

- Arredondar o valor para 2 casas no `onChange`/`blur`, evitando valores com centavos inesperados vindos de digitação/colagem.
- Quando um plano estiver selecionado e o valor digitado divergir do sugerido (preço do plano x nº de veículos), exibir um aviso visível antes de salvar, com a diferença em reais, pedindo confirmação.

Opcional, se você quiser: uma verificação de sanidade na tela de cobranças que sinaliza cobranças cujo valor difere do `monthly_value` do contrato de origem.

## Detalhes técnicos

- Dados: `contracts.monthly_value` (contrato `7dcf9fed…`) e `payment_transactions` (`eab4231f…`).
- Código: `src/components/contracts/ContractForm.tsx` (normalização + aviso de divergência).
- `supabase/functions/generate-next-charge/index.ts` permanece inalterado — o comportamento atual (contrato como fonte da verdade) está correto.
