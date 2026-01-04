import { Form } from "@/hooks/useForms";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, ExternalLink, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface FormShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: Form;
}

export const FormShareDialog = ({ open, onOpenChange, form }: FormShareDialogProps) => {
  const [copied, setCopied] = useState<string | null>(null);
  
  const formUrl = `${window.location.origin}/f/${form.slug}`;
  const embedCode = `<iframe src="${formUrl}" width="100%" height="600" frameborder="0" style="border: none;"></iframe>`;

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast.success("Copiado para a área de transferência!");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar Formulário</DialogTitle>
          <DialogDescription>
            Compartilhe o link do seu formulário ou incorpore-o em seu site
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Direct Link */}
          <div className="space-y-2">
            <Label>Link Direto</Label>
            <div className="flex gap-2">
              <Input value={formUrl} readOnly className="flex-1" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(formUrl, 'link')}
              >
                {copied === 'link' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open(formUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Embed Code */}
          <div className="space-y-2">
            <Label>Código de Incorporação (Iframe)</Label>
            <div className="flex gap-2">
              <Textarea
                value={embedCode}
                readOnly
                rows={3}
                className="flex-1 font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => handleCopy(embedCode, 'embed')}
              >
                {copied === 'embed' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Cole este código no HTML do seu site para incorporar o formulário
            </p>
          </div>

          {/* Status Warning */}
          {form.status !== 'published' && (
            <div className="bg-amber-500/10 text-amber-600 rounded-lg p-3 text-sm">
              <p>
                <strong>Atenção:</strong> Este formulário ainda não foi publicado.
                Os visitantes verão uma mensagem de erro ao acessar o link.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
