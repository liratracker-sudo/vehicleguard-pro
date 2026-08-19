# Voltar tudo para o link Lovable (appliratracker.lovable.app)

O domínio `app.liratracker.com.br` está fora do ar (status "drifted"). Hoje ele ainda é usado em três lugares: no banco (campo `domain` da empresa LIRA TRACKER), nos links já gravados nas cobranças, e como fallback no código (que ainda aponta para o antigo `vehicleguard-pro.lovable.app`).

## O que será feito

1. **Empresa LIRA TRACKER**: limpar o campo de domínio personalizado no banco, para que o sistema passe a usar automaticamente o link oficial `https://appliratracker.lovable.app`.
2. **Cobranças já criadas**: reescrever os links de pagamento das 155 cobranças em aberto/vencidas que hoje apontam para `app.liratracker.com.br` (109) ou para o antigo `vehicleguard-pro.lovable.app` (46), passando todas para `https://appliratracker.lovable.app/checkout/<id>`.
3. **Novos links (cobranças, WhatsApp, IA, e-mails)**: atualizar o endereço padrão do sistema, para que toda cobrança nova, lembrete e mensagem já saia com o link Lovable.
4. **Formulário público de cadastro e link de vendedores**: continuam usando o endereço de onde a página está aberta, então passam a funcionar no link Lovable automaticamente — só é preciso reemitir/copiar o link atualizado na tela de White Label.
5. **Documentação da API pública**: trocar o endereço exibido de `vehicleguard-pro.lovable.app` para `appliratracker.lovable.app`.

## Detalhes técnicos

- Migração SQL:
  - `UPDATE companies SET domain = NULL WHERE id = '3f86782c-...'` (LIRA TRACKER).
  - `UPDATE payment_transactions SET payment_url = 'https://appliratracker.lovable.app/checkout/' || id WHERE status IN ('pending','overdue') AND (payment_url ILIKE '%liratracker.com.br%' OR payment_url ILIKE '%vehicleguard-pro%')`.
- Secret `APP_URL` das edge functions: definir como `https://appliratracker.lovable.app`.
- `.env`: `VITE_APP_URL="https://appliratracker.lovable.app"`.
- Trocar o fallback `https://vehicleguard-pro.lovable.app` por `https://appliratracker.lovable.app` em:
  `billing-notifications`, `billing-management`, `generate-charges`, `generate-next-charge`, `process-retroactive-charges`, `update-payment-urls`, `send-reengagement-emails`, `notify-admin-email`, `ai-collection`, `ai-manager-assistant`, e em `src/components/billing/PaymentForm.tsx` e `src/pages/PublicApiDocs.tsx`.
- A empresa BRASTECH mantém o domínio próprio dela — nada muda para ela.

## Fora do escopo

- Reconectar/consertar o DNS de `app.liratracker.com.br` (feito no painel de domínios quando você quiser voltar a usá-lo).
- E-mails enviados pelo remetente `@liratracker.com.br` (isso é domínio de e-mail, não afeta o acesso ao app).
