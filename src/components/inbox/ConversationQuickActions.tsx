import { MoreVertical, Pin, PinOff, Mail, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConversationActions } from "@/hooks/useConversationActions";

interface ConversationQuickActionsProps {
  conversationId: string;
  isPinned: boolean;
  contactName: string;
  contactPhone: string;
}

export const ConversationQuickActions = ({
  conversationId,
  isPinned,
  contactName,
  contactPhone,
}: ConversationQuickActionsProps) => {
  const { 
    togglePinConversation, 
    markAsUnread, 
    deleteConversation,
    exportConversation 
  } = useConversationActions();

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-popover border border-border shadow-lg z-50">
        <DropdownMenuItem
          onClick={(e) => handleAction(e, () => togglePinConversation.mutate({ conversationId, isPinned }))}
          className="cursor-pointer"
        >
          {isPinned ? (
            <>
              <PinOff className="h-4 w-4 mr-2" />
              Desafixar conversa
            </>
          ) : (
            <>
              <Pin className="h-4 w-4 mr-2" />
              Fixar conversa
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => handleAction(e, () => markAsUnread.mutate(conversationId))}
          className="cursor-pointer"
        >
          <Mail className="h-4 w-4 mr-2" />
          Marcar como não lida
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => handleAction(e, () => exportConversation(conversationId, contactName, contactPhone))}
          className="cursor-pointer"
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar conversa
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => handleAction(e, () => deleteConversation.mutate(conversationId))}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir conversa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
