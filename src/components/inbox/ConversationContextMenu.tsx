import React, { forwardRef, useState } from "react";
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
  Tag,
  XCircle,
  RotateCcw,
  Merge
} from "lucide-react";
import { useConversationActions } from "@/hooks/useConversationActions";
import { ReactNode } from "react";
import { MergeConversationsDialog } from "./MergeConversationsDialog";

interface ConversationContextMenuProps {
  children: ReactNode;
  conversationId: string;
  isArchived: boolean;
  isPinned: boolean;
  isClosed?: boolean;
  contactName?: string;
  contactPhone?: string;
  onTagClick?: () => void;
}

export const ConversationContextMenu = forwardRef<HTMLDivElement, ConversationContextMenuProps>(
  ({ children, conversationId, isArchived, isPinned, isClosed, contactName, contactPhone, onTagClick }, ref) => {
    const [showMergeDialog, setShowMergeDialog] = useState(false);
    const { 
      archiveConversation, 
      unarchiveConversation, 
      togglePinConversation, 
      markAsUnread,
      deleteConversation,
      closeConversation,
      reopenConversation
    } = useConversationActions();

    return (
      <>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div ref={ref}>
              {children}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            {isClosed ? (
              <ContextMenuItem
                onClick={() => reopenConversation.mutate(conversationId)}
                className="cursor-pointer"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reabrir conversa
              </ContextMenuItem>
            ) : (
              <ContextMenuItem
                onClick={() => closeConversation.mutate(conversationId)}
                className="cursor-pointer"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Fechar conversa
              </ContextMenuItem>
            )}

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

            <ContextMenuItem
              onClick={() => setShowMergeDialog(true)}
              className="cursor-pointer"
            >
              <Merge className="mr-2 h-4 w-4" />
              Unificar conversas
            </ContextMenuItem>

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

        <MergeConversationsDialog
          open={showMergeDialog}
          onOpenChange={setShowMergeDialog}
          conversationId={conversationId}
          contactName={contactName || 'Contato'}
          contactPhone={contactPhone || ''}
        />
      </>
    );
  }
);

ConversationContextMenu.displayName = "ConversationContextMenu";
