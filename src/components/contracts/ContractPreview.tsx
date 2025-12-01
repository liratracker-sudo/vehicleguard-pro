import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Eye, X } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface ContractPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contractData: {
    clientName: string
    clientEmail: string
    clientPhone: string
    clientDocument: string
    planName: string
    monthlyValue: number
    vehicleInfo: string
    startDate: Date
    endDate: Date | null
    templateContent: string
  }
}

export function ContractPreview({ open, onOpenChange, contractData }: ContractPreviewProps) {
  const replaceVariables = (content: string): string => {
    const { 
      clientName, 
      clientEmail, 
      clientPhone, 
      clientDocument,
      planName, 
      monthlyValue, 
      vehicleInfo, 
      startDate, 
      endDate 
    } = contractData

    const formatCurrency = (value: number) => {
      return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }

    const formatDateStr = (date: Date | null) => {
      if (!date) return ''
      return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    }

    const endDateStr = endDate ? ` até ${formatDateStr(endDate)}` : ' (indeterminado)'

    return content
      .replace(/\{\{cliente_nome\}\}/g, clientName || '[Nome do Cliente]')
      .replace(/\{\{cliente_email\}\}/g, clientEmail || '[Email do Cliente]')
      .replace(/\{\{cliente_telefone\}\}/g, clientPhone || '[Telefone do Cliente]')
      .replace(/\{\{cliente_documento\}\}/g, clientDocument || '[Documento do Cliente]')
      .replace(/\{\{plano_nome\}\}/g, planName || '[Plano]')
      .replace(/\{\{valor_mensal\}\}/g, formatCurrency(monthlyValue || 0))
      .replace(/\{\{veiculo_info\}\}/g, vehicleInfo || 'Não aplicável')
      .replace(/\{\{data_inicio\}\}/g, formatDateStr(startDate))
      .replace(/\{\{data_fim\}\}/g, endDateStr)
  }

  const previewContent = replaceVariables(contractData.templateContent)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Pré-visualização do Contrato
            </DialogTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto border rounded-lg bg-background p-8">
          <div className="max-w-3xl mx-auto">
            <div 
              className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-serif"
              style={{ lineHeight: '1.8' }}
            >
              {previewContent}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
