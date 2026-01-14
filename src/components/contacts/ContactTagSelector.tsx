import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Check } from "lucide-react";
import { Tag } from "@/hooks/useContacts";

interface TagSelectorProps {
  tags: Tag[];
  assignedTagIds: string[];
  onSelect: (tagId: string) => void;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function TagSelector({
  tags,
  assignedTagIds,
  onSelect,
  expanded,
  onExpandedChange,
}: TagSelectorProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  const isControlled = expanded !== undefined && onExpandedChange !== undefined;
  const open = isControlled ? expanded : internalOpen;
  const setOpen = isControlled ? onExpandedChange : setInternalOpen;

  const availableTags = tags.filter(tag => !assignedTagIds.includes(tag.id));

  if (availableTags.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-1">
          {availableTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => {
                onSelect(tag.id);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted transition-colors text-sm"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              <span className="truncate">{tag.name}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
