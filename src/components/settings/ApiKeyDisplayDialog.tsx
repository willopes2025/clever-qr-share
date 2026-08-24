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
import { AlertTriangle, Copy, Check } from "lucide-react";

interface ApiKeyDisplayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiKey: string | null;
}

export function ApiKeyDisplayDialog({
  open,
  onOpenChange,
  apiKey,
}: ApiKeyDisplayDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setCopied(false);
    onOpenChange(false);
  };

  if (!apiKey) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Guarde esta chave
          </DialogTitle>
          <DialogDescription>
            Esta é a única vez que a chave completa será exibida. Após fechar
            esta janela, não será possível recuperá-la.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Input
              readOnly
              value={apiKey}
              className="font-mono text-sm pr-10"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-7"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">
            Copie e guarde esta chave em local seguro. Ela será usada nas
            requisições à API pública via{" "}
            <code className="font-mono">Authorization: Bearer &lt;key&gt;</code>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleClose}>
            {copied ? "Copiado! Fechar" : "Fechar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
