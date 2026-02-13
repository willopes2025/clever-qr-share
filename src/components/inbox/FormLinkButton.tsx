import { useState } from "react";
import { FileText, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useForms } from "@/hooks/useForms";
import { toast } from "sonner";

interface FormLinkButtonProps {
  contactId: string;
  conversationId: string;
  onInsertMessage: (message: string) => void;
}

export const FormLinkButton = ({ contactId, conversationId, onInsertMessage }: FormLinkButtonProps) => {
  const { forms, isLoading } = useForms();
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const publishedForms = forms?.filter(f => f.status === 'published') || [];

  const generateFormLink = (slug: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/f/${slug}/contact_id=${contactId}/conversation_id=${conversationId}`;
  };

  const handleSelectForm = (form: { slug: string; name: string }) => {
    const link = generateFormLink(form.slug);
    const message = `📋 Preencha este formulário: ${link}`;
    onInsertMessage(message);
    setOpen(false);
    toast.success("Link do formulário inserido na mensagem");
  };

  const handleCopyLink = (e: React.MouseEvent, form: { slug: string; id: string }) => {
    e.stopPropagation();
    const link = generateFormLink(form.slug);
    navigator.clipboard.writeText(link);
    setCopiedId(form.id);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8 md:h-10 md:w-10"
            >
              <FileText className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Enviar formulário rastreável</p>
        </TooltipContent>
      </Tooltip>

      <PopoverContent className="w-72 p-0" align="start" side="top">
        <div className="p-3 border-b">
          <h4 className="font-medium text-sm">Enviar Formulário</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecione um formulário para gerar um link rastreável
          </p>
        </div>

        <ScrollArea className="max-h-60">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : publishedForms.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhum formulário publicado
            </div>
          ) : (
            <div className="p-1">
              {publishedForms.map((form) => (
                <button
                  key={form.id}
                  onClick={() => handleSelectForm(form)}
                  className="w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{form.name}</span>
                  </div>
                  <button
                    onClick={(e) => handleCopyLink(e, form)}
                    className="shrink-0 p-1 rounded hover:bg-muted"
                  >
                    {copiedId === form.id ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
