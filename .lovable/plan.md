
# Plano: Sinalizar cobranças protestadas na tabela de cobranças

## Problema

Cobranças protestadas aparecem na listagem geral sem nenhuma indicação visual de que foram protestadas. O usuario precisa de uma forma rapida de identificar essas cobranças.

## Solucao

Adicionar uma verificacao no inicio da funcao `getStatusBadge` para cobranças protestadas, exibindo um badge diferenciado (roxo/violeta com icone de balança) antes de qualquer outra verificacao de status.

## Arquivo a alterar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Billing.tsx` | Adicionar verificacao de `protested_at` no inicio de `getStatusBadge` |

## Detalhes Tecnicos

Na funcao `getStatusBadge` (linha 168), adicionar como **primeira verificacao**:

```typescript
if (payment.protested_at) {
  return (
    <Badge className="bg-purple-600 hover:bg-purple-700 text-white border-0 font-medium">
      <Scale className="h-3 w-3 mr-1" />
      Protestado
    </Badge>
  )
}
```

O icone `Scale` ja esta importado no arquivo (linha 7). A cor roxa/violeta diferencia visualmente das demais badges (verde=pago, vermelho=vencido, laranja=esgotando, azul=pendente).

Nenhuma outra alteracao e necessaria pois o campo `protested_at` ja vem na query do `usePayments`.
