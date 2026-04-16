<final-text>Diagnóstico confirmado

- O WhatsApp não é o bloqueio principal. O envio manual funcionou e os logs de `whatsapp-evolution` mostram envio com sucesso hoje.
- O problema real está no fluxo automático da edge function `billing-notifications`.

Evidências que encontrei

1. O job automático está travando hoje
- Em `cron_execution_logs`, as execuções automáticas de hoje ficaram assim:
  - 11:02, 11:32, 12:02, 12:32, 13:02, 13:32, 14:02 UTC: `failed`
  - erro: `Timeout automático - job travado por mais de 10 minutos`
  - 14:32 UTC: ainda `running`
- Também confirmei que hoje não houve nenhuma notificação marcada como `sent`.

2. A LIRA TRACKER não tinha fila pronta para envio agora
- A LIRA tem 12 cobranças vencidas/para hoje.
- Mas ela está com `0` notificações `pending` vencendo agora (`scheduled_for <= now()+5min`).
- Ou seja: o automático não tinha nada pronto para mandar da LIRA neste momento.
- As pendentes atuais da LIRA são majoritariamente futuras (`pre_due`), não de vencidos.

3. A função está morrendo antes de criar a fila nova da LIRA
No código atual de `billing-notifications`, a ordem é:
```text
1. reset stuck sending
2. recreate overdue
3. send pending notifications
4. create missing notifications
```
- Se o passo 3 demora demais, o passo 4 nunca roda.
- É exatamente isso que explica a LIRA: como não havia fila pronta para agora, ela dependia do passo 4 para gerar notificações de vencidos/vence hoje — mas a função está travando antes disso.

4. Existe backlog pesado em outras empresas consumindo o tempo da função
- Há empresas com muitas notificações prontas para agora:
  - uma empresa com 104 pendentes prontas
  - outra com 12 pendentes prontas
- A função ainda aplica:
  - IA por mensagem
  - timeout de envio
  - delay anti-ban de 5 a 8s
  - até 25 notificações por empresa
- Com esse volume, a execução estoura o timeout global de 280s e morre no meio.

5. O cron real está diferente do que o código/migration sugere
- Os jobs ativos no banco hoje são:
  - `process-billing-notifications`
  - `process-billing-notifications-afternoon`
- Eles não estão configurados no padrão “a cada 5 minutos” mostrado em migration mais recente.
- Isso reduz a chance de recuperação rápida quando uma execução trava.

Conclusão objetiva

- O envio manual funciona porque fala direto com a função e o WhatsApp está operacional.
- O envio automático falha porque `billing-notifications` está estourando tempo de execução.
- Como a função tenta enviar backlog de outras empresas antes de criar as notificações faltantes, a LIRA fica sem gerar as notificações de vencidos/hoje.

Plano de correção

1. Reordenar o fluxo da edge function
- Mover `createMissingNotifications()` para antes de `sendPendingNotificationsParallel()`.
- Assim a LIRA gera primeiro as notificações de vencidos/vence hoje, mesmo se o envio depois travar.

2. Colocar limite de tempo por empresa
- Se uma empresa consumir muito tempo, interromper só ela e seguir para as demais.
- Evita que uma fila grande derrube o processamento global.

3. Reduzir o lote por empresa / tornar o processamento mais justo
- Em vez de deixar uma empresa monopolizar a execução, processar lotes menores por rodada.
- Isso distribui melhor entre as empresas e evita starvation da LIRA.

4. Ajustar o cron real do banco
- Padronizar os jobs ativos com a estratégia desejada.
- Remover drift entre migration e cron efetivo.

5. Melhorar observabilidade
- Adicionar logs explícitos por etapa e por empresa dentro de `billing-notifications`.
- Hoje o diagnóstico depende muito do banco e pouco de logs da própria função.

6. Limpeza operacional após correção
- Destravar a execução que ficou `running`
- Resetar item preso em `sending`, se necessário
- Forçar recriação/processamento das notificações vencidas da LIRA

Resultado esperado após a correção

- A LIRA volta a gerar notificações automáticas para cobranças vencidas e do dia
- Uma empresa com backlog não bloqueia mais as outras
- O sistema automático deixa de depender do envio manual para “destravar” o fluxo</final-text>