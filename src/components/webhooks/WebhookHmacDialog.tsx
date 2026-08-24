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
import { AlertTriangle, Copy, Check, RefreshCw } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hmacSecret: string | null;
  onRegenerate: () => Promise<void>;
  isRegenerating: boolean;
}

export function WebhookHmacDialog({
  open,
  onOpenChange,
  hmacSecret,
  onRegenerate,
  isRegenerating,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  const handleCopy = async () => {
    if (!hmacSecret) return;
    await navigator.clipboard.writeText(hmacSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    await onRegenerate();
    setShowRegenConfirm(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            HMAC Secret
          </DialogTitle>
          <DialogDescription>
            Este segredo e usado para assinar os webhooks com HMAC-SHA256.
            Guarde-o em local seguro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hmacSecret ? (
            <div className="relative">
              <Input readOnly value={hmacSecret} className="font-mono text-xs pr-10" />
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
          ) : (
            <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded">
              Nenhum secret configurado. Clique em "Gerar Secret" para criar um.
            </div>
          )}

          <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 text-sm text-blue-800 dark:text-blue-200">
            <strong>Como verificar no receptor:</strong>
            <pre className="mt-2 text-xs overflow-x-auto">{`const crypto = require('crypto');
const expected = crypto.createHmac('sha256', hmacSecret)
  .update(rawBody).digest('hex');
const received = req.headers['x-webhook-signature']
  .replace('sha256=', '');
if (expected !== received) return 401;`}</pre>
          </div>

          {showRegenConfirm ? (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <span>Regenerar vai invalidar o secret atual.</span>
              <Button size="sm" variant="destructive" onClick={handleRegenerate} disabled={isRegenerating}>
                {isRegenerating ? "Gerando..." : "Confirmar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowRegenConfirm(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowRegenConfirm(true)}
              disabled={isRegenerating}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Gerar Novo Secret
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
