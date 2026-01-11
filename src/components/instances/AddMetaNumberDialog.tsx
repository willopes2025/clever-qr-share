import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useMetaWhatsAppNumbers } from "@/hooks/useMetaWhatsAppNumbers";

interface AddMetaNumberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddMetaNumberDialog = ({ open, onOpenChange }: AddMetaNumberDialogProps) => {
  const { addNumber } = useMetaWhatsAppNumbers();
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumberId.trim()) {
      return;
    }

    await addNumber.mutateAsync({
      phoneNumberId: phoneNumberId.trim(),
      displayName: displayName.trim() || undefined,
      phoneNumber: phoneNumber.trim() || undefined,
    });

    // Reset form
    setPhoneNumberId("");
    setDisplayName("");
    setPhoneNumber("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Número Meta WhatsApp</DialogTitle>
          <DialogDescription>
            Adicione um número do WhatsApp Business API (Meta) para receber mensagens
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumberId">
              Phone Number ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phoneNumberId"
              placeholder="Ex: 873808799139009"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Encontre no Meta Business Suite: WhatsApp → Configuração → Números de telefone
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Nome de exibição</Label>
            <Input
              id="displayName"
              placeholder="Ex: Vendas, Suporte..."
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Número de telefone</Label>
            <Input
              id="phoneNumber"
              placeholder="Ex: +5527999999999"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!phoneNumberId.trim() || addNumber.isPending}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {addNumber.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adicionando...
                </>
              ) : (
                "Adicionar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
