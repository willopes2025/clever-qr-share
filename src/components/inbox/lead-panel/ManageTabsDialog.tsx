import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLeadPanelTabs } from "@/hooks/useLeadPanelTabs";
import { ConfigureTabFieldsDialog } from "./ConfigureTabFieldsDialog";

interface ManageTabsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ManageTabsDialog = ({ open, onOpenChange }: ManageTabsDialogProps) => {
  const { tabs, createTab, updateTab, deleteTab, reorderTabs } = useLeadPanelTabs();
  const [newTabName, setNewTabName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const [configureTabId, setConfigureTabId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newTabName.trim()) return;
    await createTab.mutateAsync(newTabName.trim());
    setNewTabName("");
  };

  const handleRename = async (id: string) => {
    if (!editedName.trim()) return;
    await updateTab.mutateAsync({ id, name: editedName.trim() });
    setEditingId(null);
    setEditedName("");
  };

  const handleDelete = async (id: string) => {
    await deleteTab.mutateAsync(id);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0 || !tabs) return;
    const newOrder = [...tabs];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderTabs.mutate(newOrder.map(t => t.id));
  };

  const handleMoveDown = (index: number) => {
    if (!tabs || index === tabs.length - 1) return;
    const newOrder = [...tabs];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderTabs.mutate(newOrder.map(t => t.id));
  };

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditedName(currentName);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Abas</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Create New Tab */}
            <div className="flex gap-2">
              <Input
                placeholder="Nome da nova aba..."
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <Button onClick={handleCreate} disabled={!newTabName.trim() || createTab.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Tabs List */}
            <div className="space-y-2">
              {tabs?.map((tab, index) => (
                <div 
                  key={tab.id} 
                  className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card"
                >
                  {editingId === tab.id ? (
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="flex-1 h-8"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(tab.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={() => setEditingId(null)}
                    />
                  ) : (
                    <span 
                      className="flex-1 text-sm cursor-pointer hover:text-primary"
                      onClick={() => startEditing(tab.id, tab.name)}
                    >
                      {tab.name}
                      {tab.is_default && (
                        <span className="text-xs text-muted-foreground ml-2">(Padrão)</span>
                      )}
                    </span>
                  )}

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setConfigureTabId(tab.id)}
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleMoveDown(index)}
                      disabled={!tabs || index === tabs.length - 1}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>

                    {!tab.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(tab.id)}
                        disabled={deleteTab.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Clique no nome para renomear. Use o ícone ⚙️ para configurar quais campos aparecem em cada aba.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <ConfigureTabFieldsDialog
        open={!!configureTabId}
        onOpenChange={(open) => !open && setConfigureTabId(null)}
        tabId={configureTabId}
      />
    </>
  );
};
