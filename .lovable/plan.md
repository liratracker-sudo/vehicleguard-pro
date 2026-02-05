

# Plano: Otimizar Tempo de Envio de Contratos Assinafy

## Situação Atual

O contrato está levando ~33 segundos. Analisando o fluxo, o tempo é gasto em:

1. **Polling inicial** - Espera 2 segundos antes da primeira verificação
2. **Intervalo de polling** - 2 segundos entre cada tentativa
3. **Retries de assignment** - Espera progressiva de 3s, 6s se falhar

## Otimizações Propostas

### 1. Reduzir Intervalo de Polling (2s → 1s)

O intervalo de 2 segundos é conservador. A maioria dos documentos está pronta em poucos segundos.

| Antes | Depois |
|-------|--------|
| `setTimeout(resolve, 2000)` | `setTimeout(resolve, 1000)` |
| 15 tentativas × 2s = 30s máx | 20 tentativas × 1s = 20s máx |

### 2. Primeira Verificação Imediata

Atualmente espera 2 segundos antes de verificar. Muitos documentos já estão prontos imediatamente.

**Mudança**: Verificar status imediatamente após upload, antes de iniciar o loop de polling.

### 3. Reduzir Tempo de Retry do Assignment (3s → 1s)

O retry progressivo (0s, 3s, 6s) pode ser reduzido para (0s, 1s, 2s).

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/assinafy-integration/index.ts` | Otimizar intervalos de polling |

## Implementação

```typescript
// MUDANÇA 1: Verificação imediata após upload
console.log("⏳ Checking if document is ready...");

// Verificação imediata (sem delay)
try {
  const immediateCheck = await fetch(
    `https://api.assinafy.com.br/v1/documents/${documentId}`,
    { method: 'GET', headers: { 'Authorization': `Bearer ${apiKey}` } }
  );
  if (immediateCheck.ok) {
    const statusData = await immediateCheck.json();
    const currentStatus = statusData.data?.status;
    console.log(`📊 Immediate status check: ${currentStatus}`);
    if (readyStatuses.includes(currentStatus)) {
      documentReady = true;
      console.log(`✅ Document ready immediately!`);
    }
  }
} catch (e) { /* continue with polling */ }

// MUDANÇA 2: Polling com intervalo de 1s
const maxAttempts = 20; // 20 segundos max (20 x 1s)
while (!documentReady && attempts < maxAttempts) {
  await new Promise(resolve => setTimeout(resolve, 1000)); // 1 segundo
  // ...
}

// MUDANÇA 3: Retry de assignment mais rápido
if (assignmentAttempts > 1) {
  const waitTime = assignmentAttempts * 1000; // 1s, 2s em vez de 3s, 6s
  await new Promise(resolve => setTimeout(resolve, waitTime));
}
```

## Impacto Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Primeira verificação | após 2s | imediata |
| Intervalo de polling | 2 segundos | 1 segundo |
| Retry de assignment | 0s, 3s, 6s | 0s, 1s, 2s |
| **Tempo médio estimado** | ~33 segundos | ~10-15 segundos |

## Risco

**Baixo** - Apenas reduz tempos de espera. Se a API do Assinafy for mais lenta, o sistema ainda funciona (apenas usa mais tentativas).

