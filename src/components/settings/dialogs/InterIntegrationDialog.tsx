import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InterIntegration } from "../InterIntegration"

interface InterIntegrationDialogProps {
  open: boolean
  onClose: () => void
}

export function InterIntegrationDialog({ open, onClose }: InterIntegrationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Integração Banco Inter</DialogTitle>
        </DialogHeader>
        <InterIntegration />
      </DialogContent>
    </Dialog>
  )
}
