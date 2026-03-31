import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, useForms, useFormSubmissions, useFormFields } from "@/hooks/useForms";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { 
  MoreHorizontal, 
  Edit, 
  Copy, 
  Trash2, 
  ExternalLink,
  Eye,
  Link2,
  Code,
  FileText,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface FormCardProps {
  form: Form;
}

const statusConfig = {
  draft: {
    label: "Rascunho",
    variant: "secondary" as const,
  },
  published: {
    label: "Publicado",
    variant: "default" as const,
  },
  archived: {
    label: "Arquivado",
    variant: "outline" as const,
  },
};

export const FormCard = ({ form }: FormCardProps) => {
  const navigate = useNavigate();
  const { deleteForm, duplicateForm, updateForm } = useForms();
  const { submissions } = useFormSubmissions(form.id);
  const { fields } = useFormFields(form.id);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const status = statusConfig[form.status] || statusConfig.draft;
  const publicBaseUrl = `${window.location.origin}/form/${form.slug}`;
  const formUrl = publicBaseUrl;
  const embedUrl = `${publicBaseUrl}?embed=true`;
  const embedCode = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" style="border: none; max-width: 100%;"></iframe>`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(formUrl);
    toast.success("Link copiado para a área de transferência!");
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    toast.success("Código embed copiado! Cole no HTML do seu site.");
  };

  const handlePreview = () => {
    window.open(formUrl, '_blank');
  };

  const handlePublish = () => {
    updateForm.mutate({
      id: form.id,
      status: form.status === 'published' ? 'draft' : 'published',
    });
  };

  const handleDelete = () => {
    deleteForm.mutate(form.id, {
      onSuccess: () => setShowDeleteDialog(false),
    });
  };

  const handleViewSubmissions = () => {
    navigate(`/forms/${form.id}?tab=submissions`);
  };

  const handleExportCSV = () => {
    if (!submissions || submissions.length === 0) {
      toast.info("Nenhuma resposta para exportar.");
      return;
    }
    const visibleFields = (fields || []).filter(f => !['heading', 'paragraph', 'divider'].includes(f.field_type));

    const resolveDisplayValue = (field: any, rawValue: any): string => {
      if (rawValue === undefined || rawValue === null) return '-';
      const selectTypes = ['select', 'multi_select', 'radio', 'checkbox'];
      if (selectTypes.includes(field.field_type) && field.options && Array.isArray(field.options)) {
        const optionMap = new Map(field.options.map((o: any) => [o.value, o.label]));
        if (Array.isArray(rawValue)) return rawValue.map(v => optionMap.get(v) || v).join(', ');
        if (typeof rawValue === 'string') {
          if (rawValue.startsWith('[')) {
            try {
              const arr = JSON.parse(rawValue);
              if (Array.isArray(arr)) return arr.map((v: string) => optionMap.get(v) || v).join(', ');
            } catch {}
          }
          return (optionMap.get(rawValue) || rawValue) as string;
        }
      }
      if (typeof rawValue === 'object') return JSON.stringify(rawValue);
      return String(rawValue);
    };

    const headers = ['Data', 'Contato', ...visibleFields.map(f => f.label)];
    const rows = submissions.map(sub => {
      const contactName = (sub as any).contacts?.name || (sub as any).contacts?.phone || 'Anônimo';
      const fieldValues = visibleFields.map(f => {
        const value = sub.data[f.id] ?? sub.data[f.label] ?? '';
        return resolveDisplayValue(f, value);
      });
      return [
        format(new Date(sub.created_at), 'dd/MM/yyyy HH:mm'),
        contactName,
        ...fieldValues,
      ];
    });

    const BOM = "\uFEFF";
    const csvContent = BOM + [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `respostas-${form.slug || form.id}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("Exportação concluída!");
  };

  return (
    <>
      <Card className="group hover:shadow-lg transition-all duration-200 border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{form.name}</h3>
              <p className="text-xs text-muted-foreground truncate mt-1">
                /{form.slug}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/forms/${form.id}`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePreview}>
                  <Eye className="h-4 w-4 mr-2" />
                  Visualizar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyLink}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Copiar Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyEmbed}>
                  <Code className="h-4 w-4 mr-2" />
                  Copiar Código Embed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => duplicateForm.mutate(form.id)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handlePublish}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {form.status === 'published' ? 'Despublicar' : 'Publicar'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {form.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {form.description}
              </p>
            )}
            
            <div className="flex items-center justify-between">
              <Badge variant={status.variant}>{status.label}</Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(form.created_at), "d 'de' MMM", { locale: ptBR })}
              </span>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => navigate(`/forms/${form.id}`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar Formulário
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir formulário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O formulário "{form.name}" e todas as suas submissões serão permanentemente excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
