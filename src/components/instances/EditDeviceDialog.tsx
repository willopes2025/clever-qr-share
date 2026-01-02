import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface EditDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceName: string;
  currentDeviceLabel: string | null;
  onSave: (deviceLabel: string) => Promise<void>;
  isLoading?: boolean;
}

const DEVICE_SUGGESTIONS = [
  "iPhone 15 Pro",
  "iPhone 14",
  "Samsung Galaxy S24",
  "Samsung Galaxy S23",
  "Xiaomi 14",
  "Motorola Edge 40",
  "Pixel 8 Pro",
  "OnePlus 12",
];

export const EditDeviceDialog = ({
  open,
  onOpenChange,
  instanceName,
  currentDeviceLabel,
  onSave,
  isLoading,
}: EditDeviceDialogProps) => {
  const [deviceLabel, setDeviceLabel] = useState("");

  useEffect(() => {
    if (open) {
      setDeviceLabel(currentDeviceLabel || "");
    }
  }, [open, currentDeviceLabel]);

  const handleSave = async () => {
    await onSave(deviceLabel);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Identificar Dispositivo</DialogTitle>
          <DialogDescription>
            Informe o modelo do aparelho conectado à instância "{instanceName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="device">Modelo do Dispositivo</Label>
            <Input
              id="device"
              placeholder="Ex: iPhone 15 Pro, Samsung S24..."
              value={deviceLabel}
              onChange={(e) => setDeviceLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Sugestões</Label>
            <div className="flex flex-wrap gap-2">
              {DEVICE_SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setDeviceLabel(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
