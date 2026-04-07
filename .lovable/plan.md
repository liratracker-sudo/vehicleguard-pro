

# Fix: Melhorar tratamento de erro de login quando Supabase está fora

## Problema

Quando o Supabase está com timeout (banco Postgres indisponível), o `signInWithPassword` retorna um erro sem `message` legível, e o toast mostra "Erro ao fazer login - {}".

## Causa raiz

Os auth logs confirmam que o Postgres do Supabase está com timeout de conexão (504). O erro retornado pelo SDK não tem `.message` padrão nesses casos, resultando em `{}` no toast.

## Solução

### `src/pages/Auth.tsx`

Melhorar o tratamento de erro no `signIn` para:
1. Detectar erros de rede/timeout e mostrar mensagem amigável
2. Usar `JSON.stringify` como fallback para erros sem `.message`
3. Adicionar mensagem específica para quando o servidor não responde

Alteração no bloco `if (error)` da função `signIn`:

```typescript
if (error) {
  let description = "Erro desconhecido. Tente novamente."
  if (error.message === "Invalid login credentials") {
    description = "Credenciais inválidas. Verifique seu email e senha."
  } else if (error.message && error.message.length > 0) {
    description = error.message
  } else if (error.status === 504 || error.status === 500) {
    description = "Servidor temporariamente indisponível. Tente novamente em alguns minutos."
  } else {
    description = "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente."
  }
  
  toast({
    title: "Erro ao fazer login",
    description,
    variant: "destructive"
  })
}
```

## Sobre a indisponibilidade atual

O banco Supabase está retornando 504 (timeout) nas conexões Postgres. Isso precisa ser resolvido no painel do Supabase:
- Verificar se o projeto não está pausado
- Reiniciar o banco se necessário (Settings > General > Restart project)
- Verificar se o plano não excedeu limites de conexão

## Resultado

- Mensagem clara para o usuário quando o servidor está fora
- Sem mais "{}" no toast de erro
- A correção não resolve a indisponibilidade do Supabase (isso é infraestrutura), mas melhora a experiência do usuário

