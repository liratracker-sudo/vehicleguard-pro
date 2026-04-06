

# Fix: Tela em branco ao selecionar opção no Select (mobile Chrome)

## Problema

No formulário público de cadastro (`/cadastro/:slug`), ao selecionar "Cônjuge" (ou potencialmente qualquer item) no dropdown de "Grau de Parentesco", a tela fica completamente em branco no Chrome mobile. Isso é um bug conhecido do Radix UI Select em dispositivos móveis -- o portal/overlay do dropdown não fecha corretamente e cobre toda a página.

## Causa raiz

O componente `SelectContent` usa `SelectPrimitive.Portal` que cria um overlay modal. No Chrome mobile, ao selecionar um item, o overlay pode não ser removido do DOM corretamente, deixando a tela "coberta" por um elemento invisível. Isso afeta **todos** os Selects da página pública, não apenas o de parentesco.

## Solução

Substituir todos os componentes `Select` do formulário público por elementos `<select>` nativos do HTML. No mobile, selects nativos abrem o picker nativo do sistema operacional (mais confiável e melhor UX). Isso resolve o bug sem afetar o restante da aplicação que usa Radix Select internamente.

## Alterações

### `src/pages/PublicClientRegistration.tsx`

Criar um componente auxiliar `NativeSelect` simples e substituir os 3 usos de `<Select>` nesta página:

1. **Grau de Parentesco** (linha 628-644) -- o que está causando o bug
2. **Estado** (se usar Select) -- verificar e converter também
3. **Como conheceu** (linha 680+) -- converter também

O `NativeSelect` será um `<select>` estilizado com Tailwind para manter a aparência visual consistente com o resto do formulário:

```tsx
// Componente inline no arquivo
const NativeSelect = ({ value, onChange, placeholder, children, required }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    required={required}
    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
  >
    <option value="" disabled>{placeholder}</option>
    {children}
  </select>
)
```

Substituições:
- `<Select onValueChange=...>` → `<NativeSelect onChange=...>`
- `<SelectItem value="X">X</SelectItem>` → `<option value="X">X</option>`

Nenhum outro arquivo precisa ser alterado. A mudança é isolada à página pública.

## Resultado esperado

- Selects funcionam perfeitamente no Chrome mobile com picker nativo
- Sem tela em branco ao selecionar qualquer opção
- Visual consistente com o formulário
- Zero impacto no restante da aplicação

