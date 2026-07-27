import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MetaWhatsAppNumber } from "@/hooks/useMetaWhatsAppNumbers";

interface MetaNumberTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  number: MetaWhatsAppNumber;
}

export const MetaNumberTokenDialog = ({ open, onOpenChange, number }: MetaNumberTokenDialogProps) => {
  const [token, setToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!token.trim()) {
      toast.error("Cole o token de acesso do número");
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-save-number-token", {
        body: {
          phoneNumberId: number.phone_number_id,
          accessToken: token.trim(),
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Não foi possível salvar o token");

      toast.success("Token salvo e validado na Meta com sucesso");
      setToken("");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar token");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Token exclusivo do número
          </DialogTitle>
          <DialogDescription>
            Cada número pode pertencer a uma conta comercial (WABA) diferente e por isso precisa do
            seu próprio token. Salvando aqui, este número não interfere nos demais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p><strong>Número:</strong> {number.display_name || number.phone_number || "—"}</p>
            <p><strong>Phone Number ID:</strong> <span className="font-mono">{number.phone_number_id}</span></p>
            {number.waba_id && <p><strong>WABA:</strong> <span className="font-mono">{number.waba_id}</span></p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-number-token">Token de acesso permanente</Label>
            <Input
              id="meta-number-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="EAAG..."
            />
            <p className="text-xs text-muted-foreground">
              Gere em Meta Business → Configurações do sistema → Usuários do sistema → Gerar token,
              com acesso à conta comercial deste número e permissões whatsapp_business_messaging e
              whatsapp_business_management. O token é validado na Meta antes de ser salvo e fica
              guardado apenas no servidor.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Validar e salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
