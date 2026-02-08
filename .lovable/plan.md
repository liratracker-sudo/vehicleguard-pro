

# Plano: Corrigir Rota /docs/api no Domínio Customizado

## Problema Identificado

Quando você acessa `https://app.liratracker.com.br/docs/api` diretamente:

1. O servidor busca um arquivo físico em `/docs/api`
2. Esse arquivo não existe (é uma rota SPA do React Router)
3. Resultado: **404 Not Found**

Isso acontece porque Single Page Applications (SPAs) precisam de uma configuração especial para redirecionar todas as rotas para o `index.html`, permitindo que o React Router gerencie a navegação.

## Solução

Adicionar o arquivo `public/_redirects` que instrui o servidor a redirecionar todas as requisições para o `index.html`:

## Arquivo a Criar

| Arquivo | Descrição |
|---------|-----------|
| `public/_redirects` | Configuração de redirecionamento para SPA |

## Conteúdo do Arquivo

```
/*    /index.html   200
```

Esta linha significa:
- `/*` - Qualquer rota
- `/index.html` - Servir o index.html
- `200` - Retornar status 200 (não redirecionar, apenas servir)

## Por Que Funciona

Após adicionar este arquivo:
1. Usuário acessa `/docs/api`
2. Servidor serve `index.html` (com status 200)
3. React Router carrega e reconhece a rota `/docs/api`
4. Componente `PublicApiDocs` é renderizado

## Alternativa: Verificar Publicação

Caso o arquivo `_redirects` já esteja configurado no hosting, pode ser que a última versão com a rota `/docs/api` não tenha sido publicada para produção. Neste caso, basta fazer um novo deploy/publicação do site.

## Teste Após Implementação

Acessar diretamente:
- `https://app.liratracker.com.br/docs/api`
- `https://vehicleguard-pro.lovable.app/docs/api`

Ambos devem carregar a página de documentação da API.

