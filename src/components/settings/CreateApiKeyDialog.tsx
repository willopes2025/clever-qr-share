import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, expiresAt: string | null) => Promise<void>;
  isLoading: boolean;
}

const EXPIRATION_OPTIONS = [
  { label: "Sem tempo", value: "none" },
  { label: "1 dia", value: "1d", days: 1 },
  { label: "7 dias", value: "7d", days: 7 },
  { label: "30 dias", value: "30d", days: 30 },
  { label: "Personalizado", value: "custom" },
];

export function CreateApiKeyDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: CreateApiKeyDialogProps) {
  const [name, setName] = useState("");
  const [expiration, setExpiration] = useState("none");
  const [customDate, setCustomDate] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let expiresAt: string | null = null;

    if (expiration === "custom" && customDate) {
      expiresAt = new Date(customDate + "T23:59:59").toISOString();
    } else if (expiration !== "none") {
      const opt = EXPIRATION_OPTIONS.find((o) => o.value === expiration);
      if (opt && "days" in opt) {
        const d = new Date();
        d.setDate(d.getDate() + opt.days);
        expiresAt = d.toISOString();
      }
    }

    await onSubmit(name.trim(), expiresAt);
    setName("");
    setExpiration("none");
    setCustomDate("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar API Key</DialogTitle>
          <DialogDescription>
            Crie uma nova chave de acesso à API pública. A chave será exibida
            apenas uma vez.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="key-name">Nome</Label>
              <Input
                id="key-name"
                placeholder="ex: integracao-erp, script-automacao"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label>Tempo de expiração</Label>
              <div className="flex flex-wrap gap-2">
                {EXPIRATION_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={expiration === opt.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setExpiration(opt.value)}
                    disabled={isLoading}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {expiration === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="custom-date">Data de expiração</Label>
                <Input
                  id="custom-date"
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  disabled={isLoading}
                />
              </div>
            )}

            {expiration !== "none" && (
              <p className="text-xs text-muted-foreground">
                {expiration === "custom" && customDate
                  ? `Expira em ${new Date(customDate).toLocaleDateString("pt-BR")}`
                  : `Expira em ${EXPIRATION_OPTIONS.find((o) => o.value === expiration)?.label}`}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
