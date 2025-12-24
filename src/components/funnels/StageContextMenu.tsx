import { useState } from "react";
import { Edit, Trash2, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { FunnelStage, useFunnels } from "@/hooks/useFunnels";
import { StageFormDialog } from "./StageFormDialog";

interface StageContextMenuProps {
  stage: FunnelStage;
  stages: FunnelStage[];
  funnelId: string;
}

export const StageContextMenu = ({ stage, stages, funnelId }: StageContextMenuProps) => {
  const { updateStage, deleteStage } = useFunnels();
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const currentIndex = stages.findIndex(s => s.id === stage.id);
  const canMoveLeft = currentIndex > 0;
  const canMoveRight = currentIndex < stages.length - 1;
  const hasDeals = (stage.deals?.length || 0) > 0;

  const handleMoveLeft = async () => {
    if (!canMoveLeft) return;
    const prevStage = stages[currentIndex - 1];
    await Promise.all([
      updateStage.mutateAsync({ id: stage.id, display_order: prevStage.display_order }),
      updateStage.mutateAsync({ id: prevStage.id, display_order: stage.display_order })
    ]);
  };

  const handleMoveRight = async () => {
    if (!canMoveRight) return;
    const nextStage = stages[currentIndex + 1];
    await Promise.all([
      updateStage.mutateAsync({ id: stage.id, display_order: nextStage.display_order }),
      updateStage.mutateAsync({ id: nextStage.id, display_order: stage.display_order })
    ]);
  };

  const handleDelete = async () => {
    await deleteStage.mutateAsync(stage.id);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowEdit(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar Etapa
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleMoveLeft} disabled={!canMoveLeft}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Mover para Esquerda
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={handleMoveRight} disabled={!canMoveRight}>
            <ChevronRight className="h-4 w-4 mr-2" />
            Mover para Direita
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            className="text-destructive"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={hasDeals}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir Etapa
            {hasDeals && <span className="ml-2 text-xs">(tem deals)</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <StageFormDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        funnelId={funnelId}
        stage={stage}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Etapa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a etapa "{stage.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
