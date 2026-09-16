# Cobranças do próximo mês que não foram geradas

## O que está acontecendo

Encontrei 9 clientes que pagaram entre 10 e 11 de setembro e ficaram sem a cobrança do mês seguinte:

ALEXSANDRO SILVA OLIVEIRA, JOAO VITOR DOS SANTOS NASCIMENTO, GILMAR GUEDES DE ALMEIDA, MARCELO HENRIQUE FERREIRA PINTO, DANILLO DA SILVA MELO, THIAGO MARQUES GOMES, ALEXANDRO FERREIRA SIMÕES, Jefferson Luiz de Moura Beckman, MARCOS FELLIPE CHAGAS DE ASSIS.

Causa confirmada: hoje a geração da próxima cobrança só acontece **depois** que a mensagem de "pagamento confirmado" é enviada com sucesso no WhatsApp. Nos dias 10 e 11 o servidor de WhatsApp estava fora do ar (o domínio parou de resolver), o envio falhou e o processo parou ali — nenhuma cobrança nova foi criada. Confirmei também que não existe nenhum registro de mensagem de "pagamento confirmado" nesses dois dias, o que reforça o diagnóstico.

Todos os pagamentos de outros dias do mês geraram a cobrança seguinte normalmente.

## O que vou fazer

1. **Desacoplar a geração da cobrança do WhatsApp**: a próxima cobrança passa a ser criada logo no início do processo, antes de qualquer envio de mensagem, e em todos os caminhos (sem telefone, notificações desativadas, WhatsApp fora do ar, erro de envio). Nunca mais uma falha de mensagem impede a criação da cobrança.

2. **Rede de segurança diária**: uma verificação automática que percorre os pagamentos quitados dos últimos 60 dias de contratos ativos e cria a cobrança do período seguinte que estiver faltando, com proteção contra duplicidade.

3. **Recuperar os 9 casos agora**: rodar essa mesma verificação uma vez para criar as cobranças pendentes desses clientes, com valor do contrato e link de pagamento correto.

## Detalhes técnicos

- `supabase/functions/payment-confirmed-notification/index.ts`: mover a chamada de `generate-next-charge` para antes do bloco de notificação e garantir que ela rode mesmo nos `return` antecipados (telefone ausente, `on_paid` desativado, `whatsapp_settings` inexistente) e no `catch` do envio, em vez do `throw` atual.
- Nova função `reconcile-next-charges`: busca `payment_transactions` com `status='paid'` e `paid_at >= now() - 60 dias`, contrato `active`, e sem transação posterior no mês seguinte ao `due_date`; reutiliza a mesma lógica de `generate-next-charge` (valor = `contracts.monthly_value`, `payment_url` de checkout, checagem de `end_date` e de duplicidade por janela de mês).
- Agendamento via `cron.schedule` uma vez ao dia (madrugada), registrando em `cron_execution_logs`.
- Execução única da reconciliação para cobrir os 9 pagamentos de 10–11/09.

Observação: 3 desses pagamentos foram recebidos com valor diferente do contrato (ex.: 164,75 pago x 219,60 no contrato). As novas cobranças usarão o valor do contrato, que é a referência oficial do sistema.
