
# Plano: Validacao de CPF/CNPJ com Digitos Verificadores

## Problema
A funcao `validateDocument` (linha 60-80) na edge function `mercadopago-integration` apenas verifica o tamanho do documento (11 ou 14 digitos), sem validar os digitos verificadores. Isso permite que CPFs invalidos cheguem ate a API do Mercado Pago, que retorna o erro generico `"Invalid user identification number"` (codigo 2067).

## Solucao

Modificar **1 arquivo**: `supabase/functions/mercadopago-integration/index.ts`

### Mudancas:

1. **Adicionar funcao `validateCPF(cpf: string): boolean`** - Implementa o algoritmo de validacao dos 2 digitos verificadores do CPF (modulo 11), incluindo rejeicao de CPFs com todos os digitos iguais (ex: 111.111.111-11).

2. **Adicionar funcao `validateCNPJ(cnpj: string): boolean`** - Implementa validacao dos digitos verificadores do CNPJ (modulo 11 com pesos diferentes).

3. **Atualizar funcao `validateDocument`** (linhas 60-80) - Apos verificar o tamanho, chamar `validateCPF` ou `validateCNPJ` conforme o caso. Se invalido, lancar erro com mensagem amigavel: `"CPF invalido, por favor verifique seus dados"` ou `"CNPJ invalido, por favor verifique seus dados"`.

4. **Atualizar o case `create_charge`** (linha 477+) - Garantir que a validacao e chamada antes de enviar dados para a API do Mercado Pago, no trecho onde monta o `identification` do pagador (por volta da linha 510-530).

### Detalhes Tecnicos

Algoritmo de validacao do CPF:
- Calcular primeiro digito verificador usando pesos 10,9,8,7,6,5,4,3,2
- Calcular segundo digito verificador usando pesos 11,10,9,8,7,6,5,4,3,2
- Comparar com os digitos 10 e 11 do CPF
- Rejeitar sequencias repetidas (000.000.000-00, 111.111.111-11, etc.)

A mensagem de erro retornada sera:
```json
{
  "success": false,
  "error": "CPF inválido, por favor verifique seus dados"
}
```
