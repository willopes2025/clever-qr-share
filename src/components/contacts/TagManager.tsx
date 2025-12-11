import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import { Tag } from "@/hooks/useContacts";

const TAG_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
];

interface TagManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: Tag[];
  onCreateTag: (tag: { name: string; color: string }) => void;
  onDeleteTag: (id: string) => void;
}

export const TagManager = ({
  open,
  onOpenChange,
  tags,
  onCreateTag,
  onDeleteTag,
}: TagManagerProps) => {
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);

  const handleCreate = () => {
    if (!newTagName.trim()) return;
    onCreateTag({ name: newTagName.trim(), color: selectedColor });
    setNewTagName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagIcon className="w-5 h-5" />
            Gerenciar Tags
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create new tag */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Nome da tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <Button onClick={handleCreate} size="icon">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Color picker */}
            <div className="flex gap-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  className={`w-6 h-6 rounded-full transition-all ${
                    selectedColor === color
                      ? "ring-2 ring-offset-2 ring-primary"
                      : ""
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
          </div>

          {/* Existing tags */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Tags existentes
            </p>
            <div className="flex flex-wrap gap-2">
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma tag criada ainda
                </p>
              ) : (
                tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                      borderColor: tag.color,
                    }}
                  >
                    {tag.name}
                    <button
                      onClick={() => onDeleteTag(tag.id)}
                      className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface TagSelectorProps {
  tags: Tag[];
  selectedTags: string[];
  onToggleTag: (tagId: string) => void;
}

export const TagSelector = ({
  tags,
  selectedTags,
  onToggleTag,
}: TagSelectorProps) => {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => {
        const isSelected = selectedTags.includes(tag.id);
        return (
          <button
            key={tag.id}
            onClick={() => onToggleTag(tag.id)}
            className={`px-2 py-0.5 rounded-full text-xs transition-all ${
              isSelected
                ? "ring-2 ring-offset-1"
                : "opacity-60 hover:opacity-100"
            }`}
            style={{
              backgroundColor: `${tag.color}20`,
              color: tag.color,
              borderColor: tag.color,
              ...(isSelected && { ringColor: tag.color }),
            }}
          >
            {tag.name}
          </button>
        );
      })}
    </div>
  );
};

interface ContactTagBadgesProps {
  contactTags: { tag_id: string; tags: Tag }[];
}

export const ContactTagBadges = ({ contactTags }: ContactTagBadgesProps) => {
  if (!contactTags?.length) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {contactTags.map(({ tags: tag }) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="text-xs px-1.5 py-0"
          style={{
            backgroundColor: `${tag.color}20`,
            color: tag.color,
          }}
        >
          {tag.name}
        </Badge>
      ))}
    </div>
  );
};
