import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, X, CheckSquare, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BulkActionsBarProps {
  selectedCount: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onClear: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
  entityLabel: string;
  entityLabelPlural: string;
}

export function BulkActionsBar({
  selectedCount,
  allSelected,
  onToggleAll,
  onClear,
  onDelete,
  isDeleting,
  entityLabel,
  entityLabelPlural,
}: BulkActionsBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (selectedCount === 0) return null;

  const label = selectedCount === 1 ? entityLabel : entityLabelPlural;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg border border-border bg-muted/40">
        <span className="text-sm font-medium text-foreground">
          {selectedCount} {label} {selectedCount === 1 ? 'selecionada' : 'selecionadas'}
        </span>
        <Button variant="outline" size="sm" onClick={onToggleAll}>
          <CheckSquare className="h-4 w-4 mr-2" />
          {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-4 w-4 mr-2" />
          Limpar seleção
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="ml-auto"
          disabled={isDeleting}
          onClick={() => setConfirmOpen(true)}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          Excluir selecionados
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedCount} {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os itens selecionados serão excluídos
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmOpen(false);
                onDelete();
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
