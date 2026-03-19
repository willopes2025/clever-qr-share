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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, RefreshCw, MoreVertical, Trash2, Eye, AlertCircle, Check, Clock, X, FileText } from "lucide-react";
import { MetaTemplate, useMetaTemplates } from "@/hooks/useMetaTemplates";
import { useMetaNumbersMap } from "@/hooks/useMetaNumbersMap";
import { MetaTemplateForm } from "./MetaTemplateForm";
import { MetaTemplateDeleteDialog } from "./MetaTemplateDeleteDialog";
import { MetaTemplatePreviewDialog } from "./MetaTemplatePreviewDialog";
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
  const [filterWabaId, setFilterWabaId] = useState<string | null>(null);
  const { metaNumbers } = useMetaNumbersMap();

  const {
    templates,
    isLoading,
    createTemplate,
    isCreating,
    deleteTemplate,
    isDeleting,
    syncTemplates,
    isSyncing,
  } = useMetaTemplates(filterWabaId);

  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<MetaTemplate | null>(null);

  // Build unique WABA options from meta numbers
  const wabaOptions = (() => {
    const seen = new Set<string>();
    const options: Array<{ waba_id: string; label: string }> = [];
    for (const num of metaNumbers) {
      if (num.phone_number_id) {
        // Use waba_id from the numbersMap - we need to get it from the raw data
        // The metaNumbers from useMetaNumbersMap only has phone_number_id, phone_number, display_name
        // We need waba_id - let's derive from templates or use a separate approach
      }
    }
    // Derive WABAs from templates themselves
    for (const t of templates) {
      if (t.waba_id && !seen.has(t.waba_id)) {
        seen.add(t.waba_id);
        // Find a matching number for display
        const matchingNum = metaNumbers.find(n => {
          // We can't match directly without waba_id in metaNumbers hook
          // Show the waba_id shortened
          return false;
        });
        options.push({
          waba_id: t.waba_id,
          label: `WABA ...${t.waba_id.slice(-6)}`,
        });
      }
    }
    return options;
  })();

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

  const getWabaLabel = (wabaId: string | null) => {
    if (!wabaId) return null;
    return `...${wabaId.slice(-6)}`;
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
            {wabaOptions.length > 1 && (
              <Select
                value={filterWabaId || "all"}
                onValueChange={(v) => setFilterWabaId(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todas as contas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {wabaOptions.map((opt) => (
                    <SelectItem key={opt.waba_id} value={opt.waba_id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
                {wabaOptions.length > 1 && <TableHead>Conta</TableHead>}
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
                  {wabaOptions.length > 1 && (
                    <TableCell>
                      <span className="text-xs text-muted-foreground font-mono">
                        {getWabaLabel(template.waba_id)}
                      </span>
                    </TableCell>
                  )}
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

        <MetaTemplateForm
          open={showForm}
          onOpenChange={setShowForm}
          onSubmit={handleCreate}
          isSubmitting={isCreating}
        />

        <MetaTemplateDeleteDialog
          open={!!deleteId}
          onOpenChange={() => setDeleteId(null)}
          onConfirm={handleDelete}
          isDeleting={isDeleting}
        />

        <MetaTemplatePreviewDialog
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          getStatusBadge={getStatusBadge}
        />
      </CardContent>
    </Card>
  );
}
