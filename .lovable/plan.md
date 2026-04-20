

# Fix definitivo: notificações de cobranças vencidas estagnadas

## Causa raiz (confirmada)

A função `createNotificationsForCompany` em `billing-notifications/index.ts` tenta criar múltiplos disparos por dia (`dispatchIndex 0` e `1`) usando `offset_days` igual para ambos. Mas a constraint unique do banco é `(company_id, payment_id, event_type, offset_days)` — não inclui `dispatchIndex`.

**Resultado:** O loop interno (linha 1831-1868) cria UMA notificação por execução (`break` após criar), com chave `post_due_${offset_days}_1` que não existe em `existingKeys`. Mas no upsert, o banco rejeita silenciosamente porque já existe linha com o mesmo `offset_days`. O contador `created` retorna 0 e o cliente **nunca recebe a próxima notificação** (offset 2, 3, 5, 7...).

**Evidência confirmada no banco:**
- CLAYTON RODRIGUES (38 dias atraso, LIRA TRACKER): apenas 1 `post_due` criada (`offset_days=1` em 11/03), nada mais nos 27 dias seguintes
- IAGO RODRIGUES (21d), COSME (7d), MARCELLE (7d): mesmo padrão — só `offset_days=1` existe
- LIRA tem `post_due_days=[1..18]` configurado, deveria ter 18 notificações por cliente vencido
- 491 notificações `post_due` em estado `failed` (todas da CLS PRIMER, instância WhatsApp desconectada — problema separado)

## Solução

### 1. Reescrever a lógica de criação de `post_due` (linhas 1800-1869)

- **Remover** o conceito de `dispatchIndex` que conflita com a unique constraint
- **Lógica nova:** percorrer `postDueDays` em ordem; pular `targetDays` se já existe qualquer `post_due` com aquele `offset_days` (em qualquer status); criar a primeira ausente que cliente já alcançou (`daysPastDue >= targetDays`); marcar `notificationCreated=true` e sair
- **Manter** o controle de "última enviada nas últimas 6h" como guard de cadência (linhas 1813-1826), mas só para evitar dois envios no mesmo dia, não para impedir criação futura

### 2. Recriar notificações faltantes para clientes vencidos da LIRA TRACKER

Após o deploy, executar uma rotina única para gerar todas as `post_due` faltantes dos clientes vencidos visíveis na tela do usuário:
- CLAYTON (38d): criar offsets 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18
- IAGO (21d): criar offsets 2..18
- COSME, MARCELLE (7d): criar offsets 2..7
- RENAN, TÂNIA (2d): criar offsets 2

Agendadas para hoje no horário configurado (09:00 + jitter), em sequência respeitando intervalo anti-ban.

### 3. Limpeza das 491 notificações `failed` da CLS PRIMER

Estas falharam por WhatsApp desconectado da CLS PRIMER (instância em estado `unknown`). Resetar para `pending` apenas as cuja `scheduled_for >= hoje`, para que sejam reprocessadas quando a empresa reconectar o WhatsApp. As mais antigas (>3 dias) ficam como `failed` (já não são úteis).

## Detalhes técnicos

### Mudança no código (`supabase/functions/billing-notifications/index.ts`, linhas 1800-1869)

```text
// PSEUDO-CÓDIGO da nova lógica:
if (isOverdue) {
  // Guard: só não criar se já mandamos algo nas últimas 6h
  const recentSent = await query post_due sent in last 6h
  if (recentSent.length > 0) continue;
  
  // Conjunto de offset_days que JÁ TÊM uma row (qualquer status)
  const existingOffsetDays = new Set(
    existingNotifications
      .filter(n => n.event_type === 'post_due')
      .map(n => n.offset_days)
  );
  
  // Encontrar primeiro targetDays que: (a) cliente já alcançou; (b) não existe ainda
  for (const targetDays of postDueDays) {
    if (daysPastDue < targetDays) continue;
    if (existingOffsetDays.has(targetDays)) continue;
    
    // Criar UMA notificação para este offset_days
    notifications.push({ ..., offset_days: targetDays, scheduled_for: today@send_hour })
    break; // próxima execução cria o próximo dia
  }
}
```

### Migração SQL (executada após o deploy)

1. **Gerar `post_due` faltantes para vencidos da LIRA TRACKER** (8 clientes, ~60 inserts)
2. **Resetar `failed` recentes da CLS PRIMER** que ainda fazem sentido (`scheduled_for >= CURRENT_DATE - 1`)

### Não inclui

- Reconexão do WhatsApp da CLS PRIMER (ação manual do operador da empresa)
- Mudança no cron schedule (já validado funcionando a cada 30 min)
- Refatoração do conceito de múltiplos disparos por dia (não suportado pela constraint atual; pode ser feito em iteração futura adicionando `dispatch_index` ao constraint)

## Resultado esperado

- LIRA TRACKER volta a gerar e enviar `post_due` progressivas (dia 2, 3, 5, 7... até 18) para cada cliente vencido
- CLS PRIMER terá fila pronta assim que reconectar WhatsApp
- Loop não fica mais preso tentando inserir duplicatas

