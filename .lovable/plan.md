

# Plano: Corrigir Timeout no Envio de Contratos Assinafy

## Problema Identificado

Através da análise dos logs, identifiquei a **causa raiz** do timeout:

**Logs mostram:**
```
📊 Document status (attempt 39/45): metadata_ready
⚠️ Unexpected document status: metadata_ready, will try assignment anyway
📊 Document status (attempt 40/45): metadata_ready
...
📊 Document status (attempt 42/45): metadata_ready
```

### O que está acontecendo:

1. O documento é uploadado com sucesso para o Assinafy
2. O sistema entra em loop de polling esperando o status mudar
3. O documento fica no status `metadata_ready` (novo status da API)
4. Este status **NÃO está na lista de status válidos** do código
5. O sistema continua polling por 90 segundos antes de tentar criar o assignment
6. Resultado: **timeout de ~120+ segundos**

### Causa Técnica:

O código atual verifica se o status está em:
```typescript
const readyStatuses = ['pending_signature', 'ready', 'waiting_signatures'];
```

Mas a API do Assinafy agora pode retornar `metadata_ready` como status intermediário que indica que o documento está pronto para receber assignments.

## Solução

1. **Adicionar `metadata_ready` à lista de status válidos** - Este status indica que os metadados foram processados e o documento pode receber assinantes
2. **Reduzir o tempo máximo de polling** - De 90s para 30s, já que se não estiver pronto rapidamente, provavelmente há outro problema
3. **Melhorar o log de warning** - Sair do loop mais cedo quando encontrar status inesperado

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/assinafy-integration/index.ts` | Atualizar lista de status e lógica de polling |

## Implementação Detalhada

### Mudança 1: Adicionar `metadata_ready` aos status válidos

**Antes (linha 629):**
```typescript
const readyStatuses = ['pending_signature', 'ready', 'waiting_signatures'];
```

**Depois:**
```typescript
const readyStatuses = ['pending_signature', 'ready', 'waiting_signatures', 'metadata_ready'];
```

### Mudança 2: Reduzir tempo de polling

**Antes (linha 626):**
```typescript
const maxAttempts = 45; // 90 seconds max (45 x 2s)
```

**Depois:**
```typescript
const maxAttempts = 15; // 30 seconds max (15 x 2s)
```

### Mudança 3: Melhorar handling de status inesperado

Adicionar lógica para sair do loop mais cedo quando encontrar status desconhecido após várias tentativas:

```typescript
} else {
  console.warn(`⚠️ Unexpected document status: ${currentStatus}`);
  // Se já tentou pelo menos 5 vezes e status ainda é desconhecido, tentar assignment
  if (attempts >= 5) {
    console.log(`ℹ️ Proceeding with assignment after ${attempts} attempts with status: ${currentStatus}`);
    documentReady = true; // Forçar saída do loop
  }
}
```

## Impacto

| Métrica | Antes | Depois |
|---------|-------|--------|
| Tempo máximo de polling | 90 segundos | 30 segundos |
| Status válidos | 3 | 4 (inclui `metadata_ready`) |
| Handling de status desconhecido | Continua até timeout | Sai após 5 tentativas |

## Etapas de Implementação

1. Atualizar a lista `readyStatuses` para incluir `metadata_ready`
2. Reduzir `maxAttempts` de 45 para 15
3. Adicionar lógica de saída antecipada para status desconhecido
4. Fazer deploy da edge function
5. Testar o envio do contrato

## Resultado Esperado

- Contratos devem ser enviados em **~10-20 segundos** em vez de ~120 segundos
- Status `metadata_ready` será reconhecido como válido
- Em caso de status desconhecido, o sistema tentará o assignment após 10 segundos em vez de esperar 90s

