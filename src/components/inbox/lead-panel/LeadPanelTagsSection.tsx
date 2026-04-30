import { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { TagSelector } from "../TagSelector";
import { useConversationTagAssignments } from "@/hooks/useConversationTags";

interface LeadPanelTagsSectionProps {
  conversationId: string;
}

export const LeadPanelTagsSection = ({ conversationId }: LeadPanelTagsSectionProps) => {
  const { assignments, removeTag } = useConversationTagAssignments(conversationId);
  const [tagToRemove, setTagToRemove] = useState<{ id: string; name: string } | null>(null);

  const handleConfirmRemove = () => {
    if (!tagToRemove) return;
    removeTag.mutate({ conversationId, tagId: tagToRemove.id, tagName: tagToRemove.name });
    setTagToRemove(null);
  };

  return (
    <>
      <div className="px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-1.5 flex-wrap">
          {assignments && assignments.length > 0
            ? assignments.map((assignment: any) => (
                <Badge
                  key={assignment.id}
                  variant="secondary"
                  className="text-xs pl-2 pr-1 py-0.5 font-medium gap-1 group"
                  style={{
                    backgroundColor: `${assignment.tag?.color}20`,
                    color: assignment.tag?.color,
                    borderColor: `${assignment.tag?.color}40`,
                  }}
                >
                  <span>{assignment.tag?.name}</span>
                  <button
                    onClick={() =>
                      setTagToRemove({
                        id: assignment.tag_id,
                        name: assignment.tag?.name || "tag",
                      })
                    }
                    className="ml-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5 transition-colors"
                    title="Remover tag"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            : null}

          <TagSelector conversationId={conversationId} />
        </div>
      </div>

      <AlertDialog open={!!tagToRemove} onOpenChange={(o) => !o && setTagToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover tag?</AlertDialogTitle>
            <AlertDialogDescription>
              A tag <strong>"{tagToRemove?.name}"</strong> será removida desta conversa. A tag em si não será apagada.
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
