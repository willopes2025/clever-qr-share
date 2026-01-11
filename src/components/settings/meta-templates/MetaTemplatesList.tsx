import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, RefreshCw, MoreVertical, Trash2, Eye, AlertCircle, Check, Clock, X, FileText } from "lucide-react";
import { MetaTemplate, useMetaTemplates } from "@/hooks/useMetaTemplates";
import { MetaTemplateForm } from "./MetaTemplateForm";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CONFIG = {
  draft: { label: "Rascunho", variant: "secondary" as const, icon: FileText },
  pending: { label: "Pendente", variant: "outline" as const, icon: Clock },
  approved: { label: "Aprovado", variant: "default" as const, icon: Check },
  rejected: { label: "Rejeitado", variant: "destructive" as const, icon: X },
  paused: { label: "Pausado", variant: "secondary" as const, icon: AlertCircle },
  disabled: { label: "Desativado", variant: "secondary" as const, icon: AlertCircle },
};

const CATEGORY_LABELS = {
  MARKETING: "Marketing",
  UTILITY: "Utilitário",
  AUTHENTICATION: "Autenticação",
};

export function MetaTemplatesList() {
  const {
    templates,
    isLoading,
    createTemplate,
    isCreating,
    deleteTemplate,
    isDeleting,
    syncTemplates,
    isSyncing,
  } = useMetaTemplates();

  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<MetaTemplate | null>(null);

  const handleCreate = (data: { templateData: Parameters<typeof createTemplate>[0]["templateData"]; submitToMeta: boolean }) => {
    createTemplate(data, {
      onSuccess: () => setShowForm(false),
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteTemplate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  const getStatusBadge = (status: MetaTemplate["status"]) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Templates Meta WhatsApp</CardTitle>
            <CardDescription>
              Gerencie templates para envio de mensagens via WhatsApp Business API
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => syncTemplates()} disabled={isSyncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
              Sincronizar
            </Button>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum template encontrado</p>
            <Button variant="outline" onClick={() => setShowForm(true)}>
              Criar primeiro template
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Idioma</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">
                    <div>
                      {template.name}
                      {template.rejection_reason && (
                        <p className="text-xs text-destructive mt-1">
                          {template.rejection_reason}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {CATEGORY_LABELS[template.category] || template.category}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(template.status)}</TableCell>
                  <TableCell>{template.language}</TableCell>
                  <TableCell>
                    {format(new Date(template.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPreviewTemplate(template)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(template.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Create Form Dialog */}
        <MetaTemplateForm
          open={showForm}
          onOpenChange={setShowForm}
          onSubmit={handleCreate}
          isSubmitting={isCreating}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Template</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
                Se o template já foi submetido ao Meta, ele também será excluído de lá.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeleting}
              >
                {isDeleting ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Preview Dialog */}
        <AlertDialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                {previewTemplate?.name}
                {previewTemplate && getStatusBadge(previewTemplate.status)}
              </AlertDialogTitle>
            </AlertDialogHeader>
            {previewTemplate && (
              <div className="space-y-3">
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  {previewTemplate.header_type === "TEXT" && previewTemplate.header_content && (
                    <p className="font-semibold text-sm">{previewTemplate.header_content}</p>
                  )}
                  {previewTemplate.header_type && 
                   previewTemplate.header_type !== "TEXT" && 
                   previewTemplate.header_type !== "NONE" && (
                    <div className="bg-background rounded h-24 flex items-center justify-center text-muted-foreground text-sm">
                      [{previewTemplate.header_type}]
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{previewTemplate.body_text}</p>
                  {previewTemplate.footer_text && (
                    <p className="text-xs text-muted-foreground">{previewTemplate.footer_text}</p>
                  )}
                  {previewTemplate.buttons && previewTemplate.buttons.length > 0 && (
                    <div className="flex flex-col gap-1 pt-2 border-t">
                      {previewTemplate.buttons.map((btn, idx) => (
                        <Button key={idx} variant="outline" size="sm" className="w-full" disabled>
                          {btn.text}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Categoria:</strong> {CATEGORY_LABELS[previewTemplate.category]}</p>
                  <p><strong>Idioma:</strong> {previewTemplate.language}</p>
                  {previewTemplate.meta_template_id && (
                    <p><strong>ID Meta:</strong> {previewTemplate.meta_template_id}</p>
                  )}
                  {previewTemplate.submitted_at && (
                    <p><strong>Enviado em:</strong> {format(new Date(previewTemplate.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  )}
                  {previewTemplate.approved_at && (
                    <p><strong>Aprovado em:</strong> {format(new Date(previewTemplate.approved_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  )}
                </div>
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Fechar</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
