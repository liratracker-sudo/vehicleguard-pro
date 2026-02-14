

# Plano: Otimizar Tela de Cobrancas com Paginacao

## Problema

A tela de Cobrancas carrega ate 500 registros de uma vez (`usePayments.ts`, linha 91) e renderiza todos na tabela sem paginacao. Com 180+ cobrancas ativas, isso causa lentidao.

## Solucao

Implementar paginacao de **50 itens por pagina** seguindo o mesmo padrao ja usado nas telas de Clientes e Veiculos (controles numerados centralizados).

### Arquivos a alterar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Billing.tsx` | Adicionar estado de paginacao, fatiar `sortedPayments` para exibir 50 por pagina, renderizar controles de paginacao abaixo da tabela |

### Detalhes Tecnicos

1. **Estado de paginacao**: `currentPage` (inicia em 1), reseta ao mudar filtro/busca
2. **Fatiar dados**: `sortedPayments.slice((currentPage - 1) * 50, currentPage * 50)`
3. **Controles**: Botoes "Anterior" / numeros / "Proximo" centralizados (janela deslizante de 5 paginas, mesmo padrao de Clientes/Veiculos)
4. **Contador**: Atualizar texto do header para mostrar "Exibindo 1-50 de 180 cobrancas"
5. **Reset**: Resetar para pagina 1 ao alterar busca, filtro de status ou filtro de cliente

A query no `usePayments` ja tem `.limit(500)` o que e adequado. A paginacao sera client-side sobre os dados ja carregados, mantendo filtros e ordenacao funcionando normalmente.

