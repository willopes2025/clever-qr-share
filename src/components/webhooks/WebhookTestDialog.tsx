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
import { Loader2, CheckCircle, XCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookName: string;
  onTest: () => Promise<{ success: boolean; status?: number; error?: string }>;
  isLoading: boolean;
}

export function WebhookTestDialog({
  open,
  onOpenChange,
  webhookName,
  onTest,
  isLoading,
}: Props) {
  const [result, setResult] = useState<{
    success: boolean;
    status?: number;
    error?: string;
  } | null>(null);

  const handleTest = async () => {
    const r = await onTest();
    setResult(r);
  };

  const handleClose = () => {
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Testar Webhook</DialogTitle>
          <DialogDescription>
            Enviar um payload de teste para <strong>{webhookName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            {result.success ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded text-green-800 dark:text-green-200 text-sm">
                <CheckCircle className="h-5 w-5" />
                <div>
                  <p className="font-medium">Sucesso!</p>
                  <p className="text-xs">HTTP {result.status} — webhook respondeu corretamente.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded text-red-800 dark:text-red-200 text-sm">
                <XCircle className="h-5 w-5" />
                <div>
                  <p className="font-medium">Falha</p>
                  <p className="text-xs">{result.error ?? "Webhook nao respondeu."}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Clique em "Enviar Teste" para disparar um POST com payload de teste.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? "Fechar" : "Cancelar"}
          </Button>
          {!result && (
            <Button onClick={handleTest} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Teste
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
