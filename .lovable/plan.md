

# Plano: Melhorar Documentação do Endpoint all_clients

## Situação Atual

A documentação do endpoint `all_clients` **já existe** na aba "Clientes" (linhas 363-451), mas está incompleta comparada aos outros endpoints.

### O que já está documentado:
- ✅ Endpoint URL
- ✅ Parâmetros (limit, offset, include_inactive)
- ✅ Resposta de exemplo com estrutura completa

### O que está faltando:
- ❌ Exemplo de código JavaScript
- ❌ Exemplo de paginação
- ❌ Busca por cliente específico (por CPF/placa/telefone)

## Mudanças a Implementar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/PublicApiDocs.tsx` | Adicionar exemplos de código na seção "Clientes" |

## Código a Adicionar

### 1. Exemplo JavaScript - Listar Todos os Clientes

```javascript
const response = await fetch(
  '${baseUrl}?action=all_clients&limit=100',
  {
    headers: {
      'X-API-Key': 'sk_sua_chave_aqui'
    }
  }
);

const data = await response.json();

// Processar clientes
for (const client of data.clients) {
  console.log(`Cliente: ${client.name}`);
  console.log(`  Status: ${client.payment_status}`);
  console.log(`  Veículos: ${client.vehicles.length}`);
}
```

### 2. Exemplo JavaScript - Paginação Completa

```javascript
async function getAllClients(apiKey) {
  let allClients = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    const response = await fetch(
      `${baseUrl}?action=all_clients&limit=${limit}&offset=${offset}`,
      { headers: { 'X-API-Key': apiKey } }
    );
    
    const data = await response.json();
    allClients = [...allClients, ...data.clients];
    
    if (!data.pagination.has_more) break;
    offset += limit;
  }
  
  return allClients;
}
```

### 3. Documentar Busca por Cliente Específico

Também falta documentar o endpoint `action=client` que permite buscar por:
- CPF/CNPJ
- Placa do veículo
- Telefone
- Nome

```text
GET ?action=client&document=12345678901
GET ?action=client&plate=ABC1234
GET ?action=client&phone=11999999999
GET ?action=client&name=João
```

## Resultado Esperado

A seção "Clientes" terá:
1. **Endpoint base** (já existe)
2. **Parâmetros** (já existe)  
3. **Resposta de exemplo** (já existe)
4. **Exemplo em JavaScript** (novo)
5. **Exemplo de paginação** (novo)
6. **Busca por cliente específico** (novo - seção adicional)

