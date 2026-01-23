
# Plano: Otimizar Página de Veículos com Paginação

## Problema Identificado

### 1. N+1 Queries (Problema Principal)
A página atual faz **143+ queries** ao banco:
- 1 query para buscar veículos
- 143 queries individuais para buscar cada cliente (`Promise.all`)

Isso causa lentidão extrema e sobrecarrega o banco de dados.

### 2. Sem Paginação
Renderiza todos os 143 veículos de uma vez, causando:
- Lentidão no navegador
- Scroll infinito difícil de navegar

---

## Solução

Aplicar o mesmo padrão da página de Clientes:

### Fase 1: Otimizar Query com JOIN

Substituir N+1 queries por uma única query com JOIN:

```text
ANTES (143+ queries):
┌─────────────────────────┐
│ Query 1: vehicles       │
└─────────────────────────┘
         │
         ├── Query 2: client[0]
         ├── Query 3: client[1]
         ├── Query 4: client[2]
         │   ... (143 vezes)
         └── Query 144: client[142]

DEPOIS (1 query):
┌─────────────────────────────────────────┐
│ SELECT vehicles.*, clients.name, ...    │
│ FROM vehicles                           │
│ LEFT JOIN clients ON vehicles.client_id │
└─────────────────────────────────────────┘
```

### Fase 2: Adicionar Paginação

Implementar paginação idêntica à tela de Clientes:
- 15 itens por página
- Navegação Anterior/Próximo
- Botões de página numerados
- Reset para página 1 ao buscar

### Fase 3: Melhorar UX

- Adicionar componente Skeleton durante carregamento
- Adicionar filtro por status (Ativo/Inativo/Manutenção)
- Adicionar botão de limpar busca (X)

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/Vehicles.tsx` | Refatorar query + adicionar paginação |
| `src/components/vehicles/VehicleTableSkeleton.tsx` | Criar (novo) |

---

## Implementação Técnica

### 1. Nova Query Otimizada
```typescript
// ANTES: N+1 queries
const { data } = await supabase
  .from('vehicles')
  .select('*')
  .eq('company_id', profile.company_id)
  .eq('is_active', true)

// Promise.all com 143 queries... 

// DEPOIS: 1 única query
const { data } = await supabase
  .from('vehicles')
  .select(`
    *,
    clients:client_id (
      id,
      name,
      phone
    )
  `)
  .eq('company_id', profile.company_id)
  .eq('is_active', true)
  .order('created_at', { ascending: false })
```

### 2. Paginação (15 itens/página)
```typescript
const ITEMS_PER_PAGE = 15

const totalPages = Math.ceil(filteredVehicles.length / ITEMS_PER_PAGE)
const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
const paginatedVehicles = filteredVehicles.slice(startIndex, startIndex + ITEMS_PER_PAGE)

// Reset página ao buscar
useEffect(() => {
  setCurrentPage(1)
}, [searchTerm])
```

### 3. Controles de Paginação
```typescript
{filteredVehicles.length > ITEMS_PER_PAGE && (
  <div className="flex items-center justify-center gap-2 mt-6">
    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
      <ChevronLeft /> Anterior
    </button>
    
    {/* Botões de página numerados */}
    
    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
      Próximo <ChevronRight />
    </button>
  </div>
)}
```

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Queries ao banco | 144+ | 1 |
| Itens renderizados | 143 | 15 |
| Tempo de carregamento | ~5-10s | ~500ms |
| Navegação | Scroll infinito | Paginada |

---

## Componentes Reutilizados

- Copiar padrão de `ClientsPage` para manter consistência visual
- Criar `VehicleTableSkeleton` baseado no `ClientTableSkeleton`
- Adicionar filtro por status igual ao de Clientes
