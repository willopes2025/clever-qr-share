import { useState, useMemo } from "react";
import { Tag, Plus, X, Check, AlertCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConversationTags, useConversationTagAssignments } from "@/hooks/useConversationTags";

interface TagSelectorProps {
  conversationId: string;
}

const TAG_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

export const TagSelector = ({ conversationId }: TagSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [tagToRemove, setTagToRemove] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { tags, createTag } = useConversationTags();
  const { assignments, assignTag, removeTag } = useConversationTagAssignments(conversationId);

  const assignedTagIds = new Set(assignments?.map(a => a.tag_id) || []);

  // Detect duplicate by name (case-insensitive)
  const duplicateTag = useMemo(() => {
    if (!newTagName.trim() || !tags) return null;
    return tags.find(t => t.name.toLowerCase() === newTagName.trim().toLowerCase()) || null;
  }, [newTagName, tags]);

  const assignedTags = (tags || []).filter(t => assignedTagIds.has(t.id));
  const allAvailableTags = (tags || []).filter(t => !assignedTagIds.has(t.id));
  const availableTags = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allAvailableTags;
    return allAvailableTags.filter(t => t.name.toLowerCase().includes(q));
  }, [allAvailableTags, searchQuery]);

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;

    createTag.mutate(
      { name: newTagName.trim(), color: selectedColor },
      {
        onSuccess: (created: any) => {
          setNewTagName("");
          // Auto-assign newly created tag
          if (created?.id) {
            assignTag.mutate({ conversationId, tagId: created.id, tagName: created.name });
          }
        }
      }
    );
  };

  const handleUseExistingDuplicate = () => {
    if (!duplicateTag) return;
    if (!assignedTagIds.has(duplicateTag.id)) {
      assignTag.mutate({ conversationId, tagId: duplicateTag.id, tagName: duplicateTag.name });
    }
    setNewTagName("");
  };

  const handleAddTag = (tagId: string, tagName: string) => {
    assignTag.mutate({ conversationId, tagId, tagName });
  };

  const handleConfirmRemove = () => {
    if (!tagToRemove) return;
    removeTag.mutate({ conversationId, tagId: tagToRemove.id, tagName: tagToRemove.name });
    setTagToRemove(null);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5">
            <Tag className="h-4 w-4" />
            Tags
            {assignedTagIds.size > 0 && (
              <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                {assignedTagIds.size}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          {/* Header: counter */}
          <div className="px-3 py-2 border-b border-border bg-muted/40">
            <p className="text-xs text-muted-foreground">
              {assignedTagIds.size === 0
                ? "Nenhuma tag atribuída"
                : `${assignedTagIds.size} tag${assignedTagIds.size > 1 ? 's' : ''} atribuída${assignedTagIds.size > 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Create new tag */}
          <div className="p-3 border-b border-border">
            <p className="text-sm font-medium mb-2">Nova tag</p>
            <div className="flex gap-2">
              <Input
                placeholder="Nome da tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="flex-1 h-8"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !duplicateTag) handleCreateTag();
                }}
              />
              <Button
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || !!duplicateTag || createTag.isPending}
                title={duplicateTag ? "Tag já existe" : "Criar tag"}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {duplicateTag && (
              <div className="mt-2 flex items-start gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/30">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Já existe uma tag chamada "{duplicateTag.name}".
                  </p>
                  {!assignedTagIds.has(duplicateTag.id) && (
                    <button
                      onClick={handleUseExistingDuplicate}
                      className="text-xs font-medium text-amber-700 dark:text-amber-400 underline mt-1"
                    >
                      Usar a existente
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="flex gap-1 mt-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${selectedColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                  style={{ backgroundColor: color }}
                >
                  {selectedColor === color && (
                    <Check className="h-3 w-3 text-white mx-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Assigned tags section */}
          {assignedTags.length > 0 && (
            <div className="border-b border-border">
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Atribuídas ({assignedTags.length})
              </p>
              <ScrollArea className="max-h-32">
                <div className="p-1">
                  {assignedTags.map((tag) => (
                    <div
                      key={tag.id}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm truncate">{tag.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setTagToRemove({ id: tag.id, name: tag.name })}
                        title="Remover tag"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Available tags section */}
          <div>
            <div className="px-3 py-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Adicionar ({allAvailableTags.length})
              </p>
            </div>
            {allAvailableTags.length > 5 && (
              <div className="px-3 pb-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Buscar tag..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-7 text-sm"
                  />
                </div>
              </div>
            )}
            <ScrollArea className="h-72 max-h-72">
              {availableTags.length === 0 ? (
                <p className="px-3 pb-3 text-center text-sm text-muted-foreground">
                  {searchQuery
                    ? `Nenhuma tag encontrada para "${searchQuery}"`
                    : tags && tags.length > 0 ? "Todas as tags já foram atribuídas" : "Nenhuma tag criada ainda"}
                </p>
              ) : (
                <div className="p-1">
                  {availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleAddTag(tag.id, tag.name)}
                      className="w-full flex items-center gap-2 p-2 hover:bg-accent rounded-md transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm truncate">{tag.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog open={!!tagToRemove} onOpenChange={(o) => !o && setTagToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover tag?</AlertDialogTitle>
            <AlertDialogDescription>
              A tag <strong>"{tagToRemove?.name}"</strong> será removida desta conversa. A tag em si não será apagada — você poderá atribuí-la novamente depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export const ConversationTagBadges = ({ conversationId }: { conversationId: string }) => {
  const { assignments } = useConversationTagAssignments(conversationId);

  if (!assignments || assignments.length === 0) return null;

  return (
    <div className="flex gap-1 flex-wrap">
      {assignments.slice(0, 3).map((assignment: any) => (
        <Badge
          key={assignment.id}
          variant="secondary"
          className="text-xs px-1.5 py-0"
          style={{
            backgroundColor: `${assignment.tag?.color}20`,
            color: assignment.tag?.color,
            borderColor: assignment.tag?.color
          }}
        >
          {assignment.tag?.name}
        </Badge>
      ))}
      {assignments.length > 3 && (
        <Badge variant="secondary" className="text-xs px-1.5 py-0">
          +{assignments.length - 3}
        </Badge>
      )}
    </div>
  );
};
