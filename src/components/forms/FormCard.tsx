import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, useForms } from "@/hooks/useForms";
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
  Link2
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const status = statusConfig[form.status] || statusConfig.draft;
  const formUrl = `${window.location.origin}/f/${form.slug}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(formUrl);
    toast.success("Link copiado para a área de transferência!");
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
