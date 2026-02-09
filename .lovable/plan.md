

# Plano: Ocultar Icones de Acoes e Mostrar Apenas no Hover

## Problema
Os icones de acoes na tabela de cobranças ficam sempre visiveis, poluindo visualmente o layout -- especialmente quando ha muitos botoes por linha.

## Solucao

Alterar **1 arquivo**: `src/components/billing/BillingActions.tsx`

### Mudanca:

Na div container dos botoes de acao (linha 272), adicionar classes CSS para:
- Tornar os icones **invisiveis por padrao** (`opacity-0`)
- Mostrar ao passar o mouse na **linha da tabela** (`group-hover/row:opacity-100`)
- Transicao suave (`transition-opacity`)

Tambem sera necessario garantir que as linhas da tabela onde `BillingActions` e renderizado tenham a classe `group/row` para que o seletor `group-hover/row` funcione.

### Arquivos a alterar:

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/billing/BillingActions.tsx` | Adicionar `opacity-0 group-hover/row:opacity-100 transition-opacity` no container dos icones (linha 272) e no container de "excluir permanentemente" (linha 229) |
| `src/pages/Billing.tsx` | Adicionar classe `group/row` nas `TableRow` que contêm as acoes |

### Detalhes Tecnicos

- Usar CSS `group/row` do Tailwind para escopo nomeado, evitando conflitos com outros grupos
- A transicao de opacidade (`transition-opacity`) garante animacao suave
- Os dialogs (AlertDialog, Dialog) continuam funcionando normalmente pois estao renderizados via portal, fora da row

