import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { WhatsAppIntegration } from "../WhatsAppIntegration"

interface WhatsAppIntegrationDialogProps {
  open: boolean
  onClose: () => void
}

export function WhatsAppIntegrationDialog({ open, onClose }: WhatsAppIntegrationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Integração WhatsApp</DialogTitle>
        </DialogHeader>
        <WhatsAppIntegration />
      </DialogContent>
    </Dialog>
  )
}
