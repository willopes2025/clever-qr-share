import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface EditDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  currentInstanceName: string;
  currentPhoneNumber: string | null;
  currentChipDevice: string | null;
  currentWhatsappDevice: string | null;
  onSave: (data: {
    instanceName: string;
    phoneNumber: string | null;
    chipDevice: string | null;
    whatsappDevice: string | null;
  }) => Promise<void>;
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
  currentInstanceName,
  currentPhoneNumber,
  currentChipDevice,
  currentWhatsappDevice,
  onSave,
  isLoading,
}: EditDeviceDialogProps) => {
  const [instanceName, setInstanceName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [chipDevice, setChipDevice] = useState("");
  const [whatsappDevice, setWhatsappDevice] = useState("");

  useEffect(() => {
    if (open) {
      setInstanceName(currentInstanceName || "");
      setPhoneNumber(currentPhoneNumber || "");
      setChipDevice(currentChipDevice || "");
      setWhatsappDevice(currentWhatsappDevice || "");
    }
  }, [open, currentInstanceName, currentPhoneNumber, currentChipDevice, currentWhatsappDevice]);

  const handleSave = async () => {
    if (!instanceName.trim()) return;
    
    await onSave({
      instanceName: instanceName.trim(),
      phoneNumber: phoneNumber.trim() || null,
      chipDevice: chipDevice.trim() || null,
      whatsappDevice: whatsappDevice.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Instância</DialogTitle>
          <DialogDescription>
            Configure os detalhes da instância "{currentInstanceName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Instance Name - Required */}
          <div className="space-y-2">
            <Label htmlFor="instanceName">
              Título da Instância <span className="text-destructive">*</span>
            </Label>
            <Input
              id="instanceName"
              placeholder="Ex: Vendas, Suporte, Marketing..."
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
            />
          </div>

          {/* Phone Number - Optional */}
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Número de Telefone</Label>
            <Input
              id="phoneNumber"
              placeholder="Ex: +55 27 99999-9999"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Número completo com DDI e DDD
            </p>
          </div>

          {/* Chip Device - Optional */}
          <div className="space-y-2">
            <Label htmlFor="chipDevice">Dispositivo do Chip</Label>
            <Input
              id="chipDevice"
              placeholder="Ex: iPhone 15 Pro, Samsung S24..."
              value={chipDevice}
              onChange={(e) => setChipDevice(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Aparelho onde o chip SIM está fisicamente
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {DEVICE_SUGGESTIONS.slice(0, 4).map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => setChipDevice(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>

          {/* WhatsApp Device - Optional */}
          <div className="space-y-2">
            <Label htmlFor="whatsappDevice">Dispositivo do WhatsApp</Label>
            <Input
              id="whatsappDevice"
              placeholder="Ex: iPhone 15 Pro, Samsung S24..."
              value={whatsappDevice}
              onChange={(e) => setWhatsappDevice(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Aparelho onde o app do WhatsApp está (pode ser diferente do chip via aparelho vinculado)
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {DEVICE_SUGGESTIONS.slice(0, 4).map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => setWhatsappDevice(suggestion)}
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
            disabled={isLoading || !instanceName.trim()}
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
