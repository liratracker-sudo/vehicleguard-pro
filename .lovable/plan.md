
# Plano: Corrigir Erro de Signer no Assinafy

## Problema Identificado

Através da análise dos logs do `assinafy_logs`, identifiquei a **causa raiz** do erro:

**Erro:** `Signer already exists but email mismatch. Expected: Thiagofdm1@icloud.com`

### O que está acontecendo:

1. O sistema tenta buscar um signer pelo email do cliente
2. A API do Assinafy não retorna resultados exatos na busca (busca parcial)
3. O sistema tenta criar um novo signer
4. A API do Assinafy retorna erro dizendo que o signer "já existe"
5. O sistema faz retry da busca, mas novamente não encontra correspondência exata
6. O código lança um erro fatal, impedindo o envio do contrato

### Causa Técnica:

A API do Assinafy parece fazer busca parcial (substring) em vez de exata, e quando o email existe mas com diferenças de case ou formatação, ela falha em retornar o registro correto. O código atual é muito restritivo e falha quando não encontra correspondência exata no retry.

## Solução

Modificar a lógica de `getOrCreateSigner` para ser mais resiliente:

1. **Tentar criar primeiro, capturar o ID do signer existente na resposta de erro** - Algumas APIs retornam o ID do signer existente no próprio erro
2. **Fazer paginação na busca** - Buscar mais resultados caso o signer esteja em outra página
3. **Normalizar emails para comparação** - Remover espaços e padronizar case
4. **Em caso de falha persistente, tentar busca sem filtro** - Listar todos os signers e filtrar localmente

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/assinafy-integration/index.ts` | Melhorar lógica de `getOrCreateSigner` |

## Implementação Detalhada

### Mudanças na função `getOrCreateSigner`:

```typescript
const getOrCreateSigner = async (email: string, name: string, cpf?: string): Promise<string> => {
  // Normalizar email
  const normalizedEmail = email.trim().toLowerCase();
  console.log("🔍 Checking for existing signer with email:", normalizedEmail);
  
  // 1. Tentar buscar com paginação aumentada
  try {
    const searchResponse = await makeAssinafyRequest(
      `https://api.assinafy.com.br/v1/accounts/${workspaceId}/signers?email=${encodeURIComponent(normalizedEmail)}&per-page=50`,
      'GET',
      apiKey
    );
    
    const searchData = await searchResponse.json();
    
    if (searchData.data && searchData.data.length > 0) {
      // Busca com normalização
      const matchingSigner = searchData.data.find(
        (signer: any) => signer.email?.trim().toLowerCase() === normalizedEmail
      );
      
      if (matchingSigner) {
        console.log("✅ Found exact email match:", matchingSigner.id);
        return matchingSigner.id;
      }
    }
  } catch (getError) {
    console.log("ℹ️ Initial search failed, will try to create");
  }
  
  // 2. Tentar criar
  console.log("➕ Creating new signer for:", normalizedEmail);
  try {
    const createResponse = await makeAssinafyRequest(
      `https://api.assinafy.com.br/v1/accounts/${workspaceId}/signers`,
      'POST',
      apiKey,
      { full_name: name, email: email, government_id: cpf || undefined }
    );

    const signerData = await createResponse.json();
    const newId = signerData.data?.id;
    if (newId) {
      console.log("✅ New signer created:", newId);
      return newId;
    }
  } catch (createError: any) {
    console.log("⚠️ Create failed:", createError.message);
    
    // 3. Se falhou porque já existe, buscar TODOS os signers e filtrar localmente
    if (createError.message?.includes("já existe") || createError.message?.includes("already exists")) {
      console.log("🔄 Signer exists, fetching all signers...");
      
      // Buscar com paginação maior - LISTAR TODOS
      const allSignersResponse = await makeAssinafyRequest(
        `https://api.assinafy.com.br/v1/accounts/${workspaceId}/signers?per-page=200`,
        'GET',
        apiKey
      );
      
      const allSignersData = await allSignersResponse.json();
      console.log("📋 Total signers found:", allSignersData.data?.length || 0);
      
      if (allSignersData.data && allSignersData.data.length > 0) {
        // Buscar com normalização flexível
        const matchingSigner = allSignersData.data.find(
          (signer: any) => signer.email?.trim().toLowerCase() === normalizedEmail
        );
        
        if (matchingSigner) {
          console.log("✅ Found signer in full list:", matchingSigner.id, matchingSigner.email);
          return matchingSigner.id;
        }
        
        // Se ainda não achou, mostrar primeiros 10 emails para debug
        console.log("📧 First 10 signer emails:", 
          allSignersData.data.slice(0, 10).map((s: any) => s.email)
        );
      }
    }
    
    // Se não conseguiu resolver, lança erro com mais contexto
    throw new Error(`Não foi possível criar/encontrar assinante para: ${email}. Verifique se este email já está cadastrado com outra formatação no Assinafy.`);
  }
  
  throw new Error(`Falha ao obter/criar assinante para: ${email}`);
};
```

### Principais Melhorias:

1. **Normalização de email** - `email.trim().toLowerCase()` antes de qualquer comparação
2. **Paginação aumentada** - `per-page=50` na busca inicial, `per-page=200` no retry
3. **Busca de fallback** - Se a busca filtrada falhar, buscar TODOS os signers e filtrar localmente
4. **Mensagens de erro mais claras** - Orientar o usuário sobre o problema
5. **Mais logging** - Para facilitar diagnóstico futuro

## Etapas de Implementação

1. Atualizar a função `getOrCreateSigner` no `assinafy-integration/index.ts`
2. Fazer deploy da edge function
3. Testar o envio do contrato do cliente THIAGO DE MESQUITA NUNES

## Resultado Esperado

- Contratos devem ser enviados com sucesso mesmo quando o signer já existe no Assinafy
- Sistema mais resiliente a diferenças de formatação de email
- Mensagens de erro mais claras caso ainda falhe
