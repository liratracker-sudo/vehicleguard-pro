
# Plano: Corrigir Erro de Pagamento PIX com MercadoPago

## Problema Identificado

O erro "Edge Function returned a non-2xx status code" ocorre porque:

1. **Configuração do gateway**: A empresa está configurada para usar **MercadoPago** para PIX
   ```
   payment_gateway_methods: gateway_type = 'mercadopago', payment_method = 'pix'
   ```

2. **Função não deployada**: A edge function `mercadopago-integration` existe no código mas **não está no `config.toml`**, então não foi deployada

3. **Resultado**: O `process-checkout` tenta chamar `mercadopago-integration` e recebe **404 Not Found**

## Logs que Confirmam o Problema

```
status: 404,
statusText: "Not Found",
url: "https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/mercadopago-integration"
```

## Solução

Adicionar a função `mercadopago-integration` ao `config.toml` para que seja deployada.

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/config.toml` | Adicionar configuração para `mercadopago-integration` |

## Implementação

Adicionar no final do config.toml:

```toml
[functions.mercadopago-integration]
verify_jwt = false
```

A função precisa de `verify_jwt = false` porque é chamada por outras edge functions (como `process-checkout`) que passam `company_id` diretamente, sem token JWT do usuário.

## Após o Deploy

A função `mercadopago-integration` será deployada e as cobranças PIX via MercadoPago funcionarão corretamente.

## Alternativa (se não quiser usar MercadoPago)

Se você preferir usar **Asaas** para PIX em vez de MercadoPago, é possível alterar a configuração do gateway na tabela `payment_gateway_methods` para `gateway_type = 'asaas'`.
