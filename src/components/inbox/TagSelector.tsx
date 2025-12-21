import { useState } from "react";
import { Tag, Plus, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  
  const { tags, createTag } = useConversationTags();
  const { assignments, assignTag, removeTag } = useConversationTagAssignments(conversationId);

  const assignedTagIds = new Set(assignments?.map(a => a.tag_id) || []);

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    
    createTag.mutate(
      { name: newTagName.trim(), color: selectedColor },
      {
        onSuccess: () => {
          setNewTagName("");
        }
      }
    );
  };

  const handleToggleTag = (tagId: string) => {
    if (assignedTagIds.has(tagId)) {
      removeTag.mutate({ conversationId, tagId });
    } else {
      assignTag.mutate({ conversationId, tagId });
    }
  };

  return (
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
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-3 border-b border-border">
          <p className="text-sm font-medium mb-2">Tags</p>
          <div className="flex gap-2">
            <Input
              placeholder="Nova tag..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="flex-1 h-8"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
            />
            <Button
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || createTag.isPending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
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
        
        <ScrollArea className="max-h-48">
          {(!tags || tags.length === 0) ? (
            <p className="p-3 text-center text-sm text-muted-foreground">
              Nenhuma tag criada
            </p>
          ) : (
            <div className="p-1">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleToggleTag(tag.id)}
                  className="w-full flex items-center justify-between p-2 hover:bg-accent rounded-md transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm">{tag.name}</span>
                  </div>
                  {assignedTagIds.has(tag.id) && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
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
