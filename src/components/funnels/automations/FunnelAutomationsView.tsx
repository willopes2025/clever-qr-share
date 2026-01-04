import { useState } from "react";
import { Clipboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Funnel, FunnelAutomation, useFunnels } from "@/hooks/useFunnels";
import { StageAutomationsColumn } from "./StageAutomationsColumn";
import { GlobalAutomationsColumn } from "./GlobalAutomationsColumn";
import { AutomationFormDialog } from "../AutomationFormDialog";
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

interface FunnelAutomationsViewProps {
  funnel: Funnel;
}

export const FunnelAutomationsView = ({ funnel }: FunnelAutomationsViewProps) => {
  const { automations, createAutomation, updateAutomation, deleteAutomation } = useFunnels();
  
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<FunnelAutomation | null>(null);
  const [presetStageId, setPresetStageId] = useState<string | null>(null);
  const [clipboardAutomation, setClipboardAutomation] = useState<FunnelAutomation | null>(null);
  const [draggingAutomation, setDraggingAutomation] = useState<FunnelAutomation | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [automationToDelete, setAutomationToDelete] = useState<FunnelAutomation | null>(null);

  const funnelAutomations = automations?.filter(a => a.funnel_id === funnel.id) || [];
  const stages = funnel.stages || [];

  const handleAddAutomation = (stageId: string | null) => {
    setPresetStageId(stageId);
    setEditingAutomation(null);
    setShowFormDialog(true);
  };

  const handleEditAutomation = (automation: FunnelAutomation) => {
    setEditingAutomation(automation);
    setPresetStageId(automation.stage_id);
    setShowFormDialog(true);
  };

  const handleDeleteAutomation = async () => {
    if (!automationToDelete) return;
    await deleteAutomation.mutateAsync(automationToDelete.id);
    setAutomationToDelete(null);
  };

  const handleToggleActive = async (automation: FunnelAutomation) => {
    await updateAutomation.mutateAsync({
      id: automation.id,
      stage_id: automation.stage_id,
      is_active: !automation.is_active,
    });
    toast.success(automation.is_active ? "Automação desativada" : "Automação ativada");
  };

  const handleCopyAutomation = (automation: FunnelAutomation) => {
    setClipboardAutomation(automation);
    toast.success("Automação copiada! Clique em 'Colar' em outra etapa.");
  };

  const handlePasteAutomation = async (targetStageId: string) => {
    if (!clipboardAutomation) return;

    await createAutomation.mutateAsync({
      funnel_id: funnel.id,
      stage_id: targetStageId,
      name: `${clipboardAutomation.name} (Cópia)`,
      trigger_type: clipboardAutomation.trigger_type,
      trigger_config: clipboardAutomation.trigger_config as Record<string, unknown>,
      action_type: clipboardAutomation.action_type,
      action_config: clipboardAutomation.action_config as Record<string, unknown>,
      is_active: true,
    });

    toast.success("Automação colada com sucesso!");
    setClipboardAutomation(null);
  };

  const handleDragStart = (automation: FunnelAutomation) => {
    setDraggingAutomation(automation);
  };

  const handleDragEnd = () => {
    setDraggingAutomation(null);
    setDragOverStageId(null);
  };

  const handleDrop = async (targetStageId: string) => {
    if (!draggingAutomation) return;
    
    // If dropping in same stage, do nothing
    if (draggingAutomation.stage_id === targetStageId) {
      handleDragEnd();
      return;
    }

    // Move automation to new stage
    await updateAutomation.mutateAsync({
      id: draggingAutomation.id,
      stage_id: targetStageId,
    });

    toast.success("Automação movida para nova etapa!");
    handleDragEnd();
  };

  const clearClipboard = () => {
    setClipboardAutomation(null);
    toast.info("Clipboard limpo");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-280px)]">
      {/* Clipboard indicator */}
      {clipboardAutomation && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <Clipboard className="h-4 w-4 text-primary" />
          <span className="text-sm flex-1">
            <strong>Copiado:</strong> {clipboardAutomation.name}
          </span>
          <Button variant="ghost" size="sm" onClick={clearClipboard}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Columns */}
      <ScrollArea className="flex-1">
        <div className="flex gap-4 pb-4 h-full">
          {/* Global automations column */}
          <GlobalAutomationsColumn
            automations={funnelAutomations}
            onAddAutomation={() => handleAddAutomation(null)}
            onEditAutomation={handleEditAutomation}
            onDeleteAutomation={setAutomationToDelete}
            onToggleActive={handleToggleActive}
            onCopyAutomation={handleCopyAutomation}
          />

          {/* Stage columns */}
          {stages.map((stage) => (
            <StageAutomationsColumn
              key={stage.id}
              stage={stage}
              automations={funnelAutomations}
              clipboardAutomation={clipboardAutomation}
              onAddAutomation={handleAddAutomation}
              onEditAutomation={handleEditAutomation}
              onDeleteAutomation={setAutomationToDelete}
              onToggleActive={handleToggleActive}
              onCopyAutomation={handleCopyAutomation}
              onPasteAutomation={handlePasteAutomation}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              isDragOver={dragOverStageId === stage.id}
              onDragOver={() => setDragOverStageId(stage.id)}
              onDragLeave={() => setDragOverStageId(null)}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Form Dialog */}
      <AutomationFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        funnelId={funnel.id}
        automation={editingAutomation}
        defaultStageId={presetStageId || undefined}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!automationToDelete} onOpenChange={(open) => !open && setAutomationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a automação <strong>{automationToDelete?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAutomation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
