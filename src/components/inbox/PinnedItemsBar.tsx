import { useState } from "react";
import { Pin, PinOff, StickyNote, CheckSquare, ChevronDown, ChevronUp, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useConversationNotes } from "@/hooks/useConversationNotes";
import { useUnifiedTasks } from "@/hooks/useUnifiedTasks";

interface PinnedItemsBarProps {
  conversationId: string | null;
  contactId: string | null;
}

export const PinnedItemsBar = ({ conversationId, contactId }: PinnedItemsBarProps) => {
  const { notes, updateNote } = useConversationNotes(conversationId, contactId);
  const { pendingTasks, updateTask } = useUnifiedTasks({ conversationId, contactId });
  const [expanded, setExpanded] = useState(true);

  const pinnedNotes = notes.filter((n) => n.is_pinned);
  const pinnedTasks = pendingTasks.filter((t) => t.is_pinned);
  const total = pinnedNotes.length + pinnedTasks.length;

  if (total === 0) return null;

  return (
    <div className="sticky top-0 z-20 border-b bg-amber-50/95 dark:bg-amber-950/40 backdrop-blur-sm shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium text-amber-900 dark:text-amber-100 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Pin className="h-3.5 w-3.5" />
          Fixados ({total})
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <div className="max-h-56 overflow-y-auto px-3 pb-2 space-y-1.5">
          {pinnedNotes.map((note) => (
            <div
              key={`note-${note.id}`}
              className="flex items-start gap-2 rounded-md border border-amber-200/70 dark:border-amber-800/60 bg-background/80 px-2.5 py-1.5"
            >
              <StickyNote className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs whitespace-pre-wrap break-words line-clamp-3">{note.content}</p>
                {note.creator_name && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">Por {note.creator_name}</p>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                onClick={() => updateNote.mutate({ id: note.id, isPinned: false })}
                title="Desafixar"
              >
                <PinOff className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {pinnedTasks.map((task) => (
            <div
              key={`task-${task.id}`}
              className="flex items-start gap-2 rounded-md border border-amber-200/70 dark:border-amber-800/60 bg-background/80 px-2.5 py-1.5"
            >
              <CheckSquare className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium break-words line-clamp-2">{task.title}</p>
                {task.description && (
                  <p className="text-[11px] text-muted-foreground break-words line-clamp-2 mt-0.5">
                    {task.description}
                  </p>
                )}
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                  {task.due_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      {task.due_date}
                    </span>
                  )}
                  {task.due_time && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {task.due_time.slice(0, 5)}
                    </span>
                  )}
                  {task.assignee_name && <span>• {task.assignee_name}</span>}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                onClick={() =>
                  updateTask.mutate({ id: task.id, source: task.source, is_pinned: false })
                }
                title="Desafixar"
              >
                <PinOff className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
