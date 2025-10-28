import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { GerencianetIntegration } from "../GerencianetIntegration"

interface GerencianetIntegrationDialogProps {
  open: boolean
  onClose: () => void
}

export function GerencianetIntegrationDialog({ open, onClose }: GerencianetIntegrationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Integração Gerencianet / Efí Pay</DialogTitle>
        </DialogHeader>
        <GerencianetIntegration />
      </DialogContent>
    </Dialog>
  )
}
