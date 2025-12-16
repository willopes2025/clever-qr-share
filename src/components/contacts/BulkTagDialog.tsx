import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tag } from "@/hooks/useContacts";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface BulkTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: Tag[];
  selectedCount: number;
  onApplyTags: (tagIds: string[]) => void;
  isLoading?: boolean;
}

export const BulkTagDialog = ({
  open,
  onOpenChange,
  tags,
  selectedCount,
  onApplyTags,
  isLoading,
}: BulkTagDialogProps) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleToggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleApply = () => {
    onApplyTags(selectedTags);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedTags([]);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Tags em Massa</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Selecione as tags que deseja adicionar aos{" "}
            <strong>{selectedCount} contatos</strong> selecionados.
          </p>

          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma tag cadastrada. Crie tags primeiro.
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {tags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={selectedTags.includes(tag.id)}
                    onCheckedChange={() => handleToggleTag(tag.id)}
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm">{tag.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleApply}
            disabled={selectedTags.length === 0 || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Aplicando...
              </>
            ) : (
              `Aplicar ${selectedTags.length} tag${selectedTags.length !== 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
