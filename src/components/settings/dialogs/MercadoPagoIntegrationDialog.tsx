import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MercadoPagoIntegration } from "../MercadoPagoIntegration"

interface MercadoPagoIntegrationDialogProps {
  open: boolean
  onClose: () => void
}

export function MercadoPagoIntegrationDialog({ open, onClose }: MercadoPagoIntegrationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Integração Mercado Pago</DialogTitle>
        </DialogHeader>
        <MercadoPagoIntegration />
      </DialogContent>
    </Dialog>
  )
}
