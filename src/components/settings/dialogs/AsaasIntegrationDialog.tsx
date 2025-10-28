import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AsaasIntegration } from "../AsaasIntegration"

interface AsaasIntegrationDialogProps {
  open: boolean
  onClose: () => void
}

export function AsaasIntegrationDialog({ open, onClose }: AsaasIntegrationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Integração Asaas</DialogTitle>
        </DialogHeader>
        <AsaasIntegration />
      </DialogContent>
    </Dialog>
  )
}
