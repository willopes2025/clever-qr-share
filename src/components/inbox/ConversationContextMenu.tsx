import React, { forwardRef, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
              onClick={() => setShowDeleteConfirm(true)}
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

        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Todas as mensagens desta conversa serão permanentemente excluídas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteConversation.mutate(conversationId)}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }
);

ConversationContextMenu.displayName = "ConversationContextMenu";
