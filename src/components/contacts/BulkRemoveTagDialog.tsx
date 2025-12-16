import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tag } from "@/hooks/useContacts";
import { Loader2 } from "lucide-react";

interface BulkRemoveTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: Tag[];
  selectedCount: number;
  onRemoveTags: (tagIds: string[]) => void;
  isLoading?: boolean;
}

export const BulkRemoveTagDialog = ({
  open,
  onOpenChange,
  tags,
  selectedCount,
  onRemoveTags,
  isLoading,
}: BulkRemoveTagDialogProps) => {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleApply = () => {
    onRemoveTags(selectedTagIds);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedTagIds([]);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remover tags em massa</DialogTitle>
          <DialogDescription>
            Selecione as tags que deseja remover dos {selectedCount} contato(s)
            selecionado(s).
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma tag disponível
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleToggleTag(tag.id)}
                >
                  <Checkbox
                    checked={selectedTagIds.includes(tag.id)}
                    onCheckedChange={() => handleToggleTag(tag.id)}
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm">{tag.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleApply}
            disabled={selectedTagIds.length === 0 || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Removendo...
              </>
            ) : (
              `Remover ${selectedTagIds.length} tag(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
