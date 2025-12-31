import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TagSelector } from "../TagSelector";
import { useConversationTagAssignments } from "@/hooks/useConversationTags";

interface LeadPanelTagsSectionProps {
  conversationId: string;
}

export const LeadPanelTagsSection = ({ conversationId }: LeadPanelTagsSectionProps) => {
  const { assignments } = useConversationTagAssignments(conversationId);

  return (
    <div className="px-3 py-2 border-b border-border/30">
      <div className="flex items-center gap-1.5 flex-wrap">
        {assignments && assignments.length > 0 ? (
          <>
            {assignments.map((assignment: any) => (
              <Badge
                key={assignment.id}
                variant="secondary"
                className="text-xs px-2 py-0.5 font-medium"
                style={{ 
                  backgroundColor: `${assignment.tag?.color}20`,
                  color: assignment.tag?.color,
                  borderColor: `${assignment.tag?.color}40`
                }}
              >
                {assignment.tag?.name}
              </Badge>
            ))}
          </>
        ) : null}
        
        <TagSelector conversationId={conversationId} />
      </div>
    </div>
  );
};
