import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MetaWebhookConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MetaWebhookConfigDialog = ({ open, onOpenChange }: MetaWebhookConfigDialogProps) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-whatsapp-webhook`;
  const verifyToken = "wpp_uz8cau035787qeju3ykqzt";

  const handleCopy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success("Copiado!");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const steps = [
    {
      number: 1,
      title: "Acesse o Meta Business Suite",
      content: (
        <p className="text-sm text-muted-foreground">
          Vá para{" "}
          <a 
            href="https://developers.facebook.com/apps" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            developers.facebook.com/apps
            <ExternalLink className="h-3 w-3" />
          </a>
          {" "}e selecione seu aplicativo WhatsApp Business.
        </p>
      ),
    },
    {
      number: 2,
      title: "Configure o Webhook",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No menu lateral, vá em <strong>WhatsApp → Configuração</strong> e clique em <strong>Editar</strong> na seção de Webhook.
          </p>
        </div>
      ),
    },
    {
      number: 3,
      title: "Cole a URL do Webhook",
      content: (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">URL de Callback</Label>
          <div className="flex gap-2">
            <Input 
              value={webhookUrl} 
              readOnly 
              className="font-mono text-xs bg-muted/50"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => handleCopy(webhookUrl, "url")}
            >
              {copiedField === "url" ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      ),
    },
    {
      number: 4,
      title: "Cole o Token de Verificação",
      content: (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Verify Token</Label>
          <div className="flex gap-2">
            <Input 
              value={verifyToken} 
              readOnly 
              className="font-mono text-xs bg-muted/50"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => handleCopy(verifyToken, "token")}
            >
              {copiedField === "token" ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      ),
    },
    {
      number: 5,
      title: "Selecione os campos do Webhook",
      content: (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Após verificar, clique em <strong>Gerenciar</strong> e ative os seguintes campos:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li><code className="bg-muted px-1 rounded">messages</code> - Mensagens recebidas</li>
            <li><code className="bg-muted px-1 rounded">message_status</code> - Status de entrega</li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Configurar Webhook Meta WhatsApp
          </DialogTitle>
          <DialogDescription>
            Siga os passos abaixo para configurar o webhook no Meta Business Suite
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-blue-500/10 border-blue-500/30">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-sm">
            O webhook permite que você receba mensagens do WhatsApp Business API em tempo real.
            Após configurar, as mensagens aparecerão automaticamente no seu inbox.
          </AlertDescription>
        </Alert>

        <div className="space-y-6 py-4">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                {step.number}
              </div>
              <div className="flex-1 space-y-2">
                <h4 className="font-medium">{step.title}</h4>
                {step.content}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            onClick={() => window.open("https://developers.facebook.com/apps", "_blank")}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir Meta Business
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
