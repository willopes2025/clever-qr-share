import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronUp, ChevronDown, GripVertical, Users, Save, Loader2, Pencil, Trash2 } from "lucide-react";
import { TeamMember } from "@/hooks/useOrganization";
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

export interface ColumnDefinition {
  id: string;
  label: string;
  type: string;
  fixed?: boolean;
  /** ID do custom_field_definitions, presente quando a coluna é um campo personalizado */
  customFieldId?: string;
}

interface ColumnsConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnDefinition[];
  visibleColumns: string[];
  columnOrder: string[];
  onSave: (visibleColumns: string[], columnOrder: string[], applyToMemberIds?: string[]) => void;
  teamMembers?: TeamMember[];
  isSaving?: boolean;
  /** Chamado ao clicar em editar campo personalizado (recebe o customFieldId) */
  onEditCustomField?: (customFieldId: string) => void;
  /** Chamado ao confirmar exclusão do campo personalizado */
  onDeleteCustomField?: (customFieldId: string) => Promise<void> | void;
}

export const ColumnsConfigDialog = ({
  open,
  onOpenChange,
  columns,
  visibleColumns,
  columnOrder,
  onSave,
  teamMembers = [],
  isSaving = false,
  onEditCustomField,
  onDeleteCustomField,
}: ColumnsConfigDialogProps) => {
  const [localVisible, setLocalVisible] = useState<string[]>(visibleColumns);
  const [localOrder, setLocalOrder] = useState<string[]>(columnOrder);
  const [showTeamShare, setShowTeamShare] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalVisible([...visibleColumns]);
      setLocalOrder([...columnOrder]);
      setShowTeamShare(false);
      setSelectedMemberIds([]);
    }
  }, [open, visibleColumns, columnOrder]);

  const toggleColumn = (colId: string) => {
    if (localVisible.includes(colId)) {
      setLocalVisible(localVisible.filter((id) => id !== colId));
    } else {
      setLocalVisible([...localVisible, colId]);
    }
  };

  const moveColumn = (colId: string, direction: "up" | "down") => {
    const currentIndex = localOrder.indexOf(colId);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= localOrder.length) return;

    const newOrder = [...localOrder];
    [newOrder[currentIndex], newOrder[newIndex]] = [
      newOrder[newIndex],
      newOrder[currentIndex],
    ];
    setLocalOrder(newOrder);
  };

  const toggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleAllMembers = () => {
    const activeMembers = teamMembers.filter((m) => m.status === "active" && m.user_id);
    if (selectedMemberIds.length === activeMembers.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(activeMembers.map((m) => m.user_id!));
    }
  };

  const handleSave = () => {
    onSave(
      localVisible,
      localOrder,
      selectedMemberIds.length > 0 ? selectedMemberIds : undefined
    );
  };

  const orderedColumns = localOrder
    .map((id) => columns.find((c) => c.id === id))
    .filter(Boolean) as ColumnDefinition[];

  const activeMembers = teamMembers.filter((m) => m.status === "active" && m.user_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Colunas</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[350px]">
          <div className="space-y-1 py-2 pr-3">
            {orderedColumns.map((col, index) => (
              <div
                key={col.id}
                className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <Checkbox
                  checked={localVisible.includes(col.id)}
                  onCheckedChange={() => toggleColumn(col.id)}
                  disabled={col.fixed}
                />
                <span className="flex-1 text-sm truncate">{col.label}</span>
                <div className="flex gap-1">
                  {col.customFieldId && onEditCustomField && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Editar campo"
                      onClick={() => onEditCustomField(col.customFieldId!)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {col.customFieldId && onDeleteCustomField && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      title="Excluir campo"
                      onClick={() => setPendingDelete({ id: col.customFieldId!, label: col.label })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={index === 0}
                    onClick={() => moveColumn(col.id, "up")}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={index === orderedColumns.length - 1}
                    onClick={() => moveColumn(col.id, "down")}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Team sharing section */}
        {activeMembers.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => setShowTeamShare(!showTeamShare)}
            >
              <Users className="h-4 w-4 mr-2" />
              Aplicar para integrantes da equipe
              <ChevronDown
                className={`h-4 w-4 ml-auto transition-transform ${showTeamShare ? "rotate-180" : ""}`}
              />
            </Button>

            {showTeamShare && (
              <div className="space-y-2 pl-2">
                <div className="flex items-center gap-2 pb-1">
                  <Checkbox
                    checked={selectedMemberIds.length === activeMembers.length && activeMembers.length > 0}
                    onCheckedChange={toggleAllMembers}
                  />
                  <Label className="text-xs text-muted-foreground cursor-pointer" onClick={toggleAllMembers}>
                    Selecionar todos
                  </Label>
                </div>
                <ScrollArea className="max-h-[150px]">
                  <div className="space-y-1 pr-3">
                    {activeMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => member.user_id && toggleMember(member.user_id)}
                      >
                        <Checkbox
                          checked={member.user_id ? selectedMemberIds.includes(member.user_id) : false}
                          onCheckedChange={() => member.user_id && toggleMember(member.user_id)}
                        />
                        <span className="text-sm">
                          {member.profile?.full_name || member.email || "Membro"}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">{member.role}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {selectedMemberIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    A configuração será aplicada para {selectedMemberIds.length} integrante(s)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
