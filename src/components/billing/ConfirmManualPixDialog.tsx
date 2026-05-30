import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBillingManagement } from "@/hooks/useBillingManagement";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  paymentId: string;
  defaultAmount: number;
  onConfirmed: () => void;
}

export function ConfirmManualPixDialog({ open, onOpenChange, paymentId, defaultAmount, onConfirmed }: Props) {
  const { confirmManualPix, loading } = useBillingManagement();
  const [paidAt, setPaidAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [note, setNote] = useState<string>("");

  const handleConfirm = async () => {
    const ok = await confirmManualPix(paymentId, {
      paid_at: paidAt,
      amount,
      note,
    });
    if (ok) {
      onOpenChange(false);
      onConfirmed();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar pagamento via PIX manual</DialogTitle>
          <DialogDescription>
            Informe a data efetiva e o valor recebido. O status ficará como "pago" e o gateway será marcado como PIX Manual.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Data do pagamento</Label>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <div>
            <Label>Valor recebido (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label>Observação (opcional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading || amount <= 0}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
