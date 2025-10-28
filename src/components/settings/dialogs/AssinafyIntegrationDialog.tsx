import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AssinafyIntegration } from "../AssinafyIntegration"

interface AssinafyIntegrationDialogProps {
  open: boolean
  onClose: () => void
}

export function AssinafyIntegrationDialog({ open, onClose }: AssinafyIntegrationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Integração Assinafy</DialogTitle>
        </DialogHeader>
        <AssinafyIntegration />
      </DialogContent>
    </Dialog>
  )
}
