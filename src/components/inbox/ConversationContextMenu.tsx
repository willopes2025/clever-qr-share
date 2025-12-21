import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { 
  Archive, 
  ArchiveRestore, 
  Pin, 
  PinOff, 
  MailOpen, 
  Trash2,
  Tag
} from "lucide-react";
import { useConversationActions } from "@/hooks/useConversationActions";
import { ReactNode } from "react";

interface ConversationContextMenuProps {
  children: ReactNode;
  conversationId: string;
  isArchived: boolean;
  isPinned: boolean;
  onTagClick?: () => void;
}

export const ConversationContextMenu = ({
  children,
  conversationId,
  isArchived,
  isPinned,
  onTagClick
}: ConversationContextMenuProps) => {
  const { 
    archiveConversation, 
    unarchiveConversation, 
    togglePinConversation, 
    markAsUnread,
    deleteConversation
  } = useConversationActions();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          onClick={() => togglePinConversation.mutate({ conversationId, isPinned })}
          className="cursor-pointer"
        >
          {isPinned ? (
            <>
              <PinOff className="mr-2 h-4 w-4" />
              Desafixar
            </>
          ) : (
            <>
              <Pin className="mr-2 h-4 w-4" />
              Fixar no topo
            </>
          )}
        </ContextMenuItem>
        
        <ContextMenuItem
          onClick={() => markAsUnread.mutate(conversationId)}
          className="cursor-pointer"
        >
          <MailOpen className="mr-2 h-4 w-4" />
          Marcar como não lida
        </ContextMenuItem>

        {onTagClick && (
          <ContextMenuItem onClick={onTagClick} className="cursor-pointer">
            <Tag className="mr-2 h-4 w-4" />
            Gerenciar tags
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {isArchived ? (
          <ContextMenuItem
            onClick={() => unarchiveConversation.mutate(conversationId)}
            className="cursor-pointer"
          >
            <ArchiveRestore className="mr-2 h-4 w-4" />
            Desarquivar
          </ContextMenuItem>
        ) : (
          <ContextMenuItem
            onClick={() => archiveConversation.mutate(conversationId)}
            className="cursor-pointer"
          >
            <Archive className="mr-2 h-4 w-4" />
            Arquivar
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem
          onClick={() => deleteConversation.mutate(conversationId)}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
