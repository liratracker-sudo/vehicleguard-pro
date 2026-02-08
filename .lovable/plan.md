
# Plano: Adicionar Exportação de PDF na Documentação da API

## Objetivo

Adicionar um botão "Baixar PDF" no header da página de documentação pública da API, permitindo que usuários e IAs baixem toda a documentação para referência offline.

## Mudanças Necessárias

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/PublicApiDocs.tsx` | Adicionar botão de exportar PDF e lógica de geração |

## Implementação

### 1. Adicionar imports necessários

```typescript
import { useRef, useState } from "react";
import html2pdf from "html2pdf.js";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
```

### 2. Adicionar estados e ref

```typescript
const [isExporting, setIsExporting] = useState(false);
const contentRef = useRef<HTMLDivElement>(null);
```

### 3. Criar função de exportação

```typescript
const handleExportPDF = async () => {
  if (!contentRef.current) return;

  setIsExporting(true);
  try {
    toast("Gerando PDF da documentação...");
    
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `VehicleGuard-API-Docs-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    await html2pdf().set(opt).from(contentRef.current).save();
    toast.success("PDF gerado com sucesso!");
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    toast.error("Erro ao gerar PDF. Tente novamente.");
  } finally {
    setIsExporting(false);
  }
};
```

### 4. Modificar header para incluir botão

Adicionar ao lado do badge de versão:

```tsx
<div className="flex items-center gap-3">
  <Button
    onClick={handleExportPDF}
    disabled={isExporting}
    variant="outline"
    className="border-slate-600 text-slate-300 hover:bg-slate-700"
  >
    {isExporting ? (
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
    ) : (
      <Download className="h-4 w-4 mr-2" />
    )}
    Baixar PDF
  </Button>
  <Badge variant="outline" className="border-green-500 text-green-400">
    v1.0
  </Badge>
</div>
```

### 5. Envolver conteúdo principal com ref

```tsx
<main className="container mx-auto px-4 py-8 max-w-6xl" ref={contentRef}>
  {/* Todo o conteúdo existente */}
</main>
```

## Layout Final do Header

```text
┌──────────────────────────────────────────────────────────────┐
│  [Zap Icon] VehicleGuard Pro API          [Baixar PDF] [v1.0]│
│             Documentação para Integração...                  │
└──────────────────────────────────────────────────────────────┘
```

## Benefícios

- Permite salvar a documentação para consulta offline
- IAs e desenvolvedores podem usar o PDF como referência
- Facilita compartilhamento com equipes técnicas
- Usa a mesma biblioteca `html2pdf.js` já instalada no projeto

## Considerações Técnicas

- A biblioteca `html2pdf.js` já está instalada e sendo usada em `ContractPreview.tsx` e `Reports.tsx`
- O toast de feedback usa `sonner` já configurado no projeto
- O PDF será gerado com todo o conteúdo visível da página
