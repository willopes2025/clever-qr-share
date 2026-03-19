import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetaTemplate } from "@/hooks/useMetaTemplates";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ReactNode } from "react";

const CATEGORY_LABELS: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilitário",
  AUTHENTICATION: "Autenticação",
};

interface MetaTemplatePreviewDialogProps {
  template: MetaTemplate | null;
  onClose: () => void;
  getStatusBadge: (status: MetaTemplate["status"]) => ReactNode;
}

export function MetaTemplatePreviewDialog({ template, onClose, getStatusBadge }: MetaTemplatePreviewDialogProps) {
  return (
    <AlertDialog open={!!template} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {template?.name}
            {template && getStatusBadge(template.status)}
          </AlertDialogTitle>
        </AlertDialogHeader>
        {template && (
          <div className="space-y-3">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              {template.header_type === "TEXT" && template.header_content && (
                <p className="font-semibold text-sm">{template.header_content}</p>
              )}
              {template.header_type &&
                template.header_type !== "TEXT" &&
                template.header_type !== "NONE" && (
                  <div className="bg-background rounded h-24 flex items-center justify-center text-muted-foreground text-sm">
                    [{template.header_type}]
                  </div>
                )}
              <p className="text-sm whitespace-pre-wrap">{template.body_text}</p>
              {template.footer_text && (
                <p className="text-xs text-muted-foreground">{template.footer_text}</p>
              )}
              {template.buttons && template.buttons.length > 0 && (
                <div className="flex flex-col gap-1 pt-2 border-t">
                  {template.buttons.map((btn, idx) => (
                    <Button key={idx} variant="outline" size="sm" className="w-full" disabled>
                      {btn.text}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Categoria:</strong> {CATEGORY_LABELS[template.category]}</p>
              <p><strong>Idioma:</strong> {template.language}</p>
              {template.waba_id && (
                <p><strong>WABA ID:</strong> {template.waba_id}</p>
              )}
              {template.meta_template_id && (
                <p><strong>ID Meta:</strong> {template.meta_template_id}</p>
              )}
              {template.submitted_at && (
                <p><strong>Enviado em:</strong> {format(new Date(template.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
              )}
              {template.approved_at && (
                <p><strong>Aprovado em:</strong> {format(new Date(template.approved_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
              )}
            </div>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Fechar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
