import { useState } from "react";
import { MoreVertical, Pin, PinOff, Mail, Download, Trash2, ArrowRightLeft, XCircle, RotateCcw, Merge } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConversationActions } from "@/hooks/useConversationActions";
import { TransferConversationDialog } from "./TransferConversationDialog";
import { MergeConversationsDialog } from "./MergeConversationsDialog";

interface ConversationQuickActionsProps {
  conversationId: string;
  isPinned: boolean;
  contactName: string;
  contactPhone: string;
  status?: string;
  onTransferred?: () => void;
}

export const ConversationQuickActions = ({
  conversationId,
  isPinned,
  contactName,
  contactPhone,
  status = 'active',
  onTransferred,
}: ConversationQuickActionsProps) => {
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const { 
    togglePinConversation, 
    markAsUnread, 
    deleteConversation,
    exportConversation,
    closeConversation,
    reopenConversation
  } = useConversationActions();

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  const isClosed = status === 'closed';

  return (
    <>
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
          {isClosed ? (
            <DropdownMenuItem
              onClick={(e) => handleAction(e, () => reopenConversation.mutate(conversationId))}
              className="cursor-pointer"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reabrir conversa
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={(e) => handleAction(e, () => closeConversation.mutate(conversationId))}
              className="cursor-pointer"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Fechar conversa
            </DropdownMenuItem>
          )}
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
            onClick={(e) => handleAction(e, () => setShowTransferDialog(true))}
            className="cursor-pointer"
          >
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Transferir conversa
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => handleAction(e, () => setShowMergeDialog(true))}
            className="cursor-pointer"
          >
            <Merge className="h-4 w-4 mr-2" />
            Unificar conversas
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

      <TransferConversationDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        conversationId={conversationId}
        contactName={contactName}
        onTransferred={onTransferred}
      />

      <MergeConversationsDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        conversationId={conversationId}
        contactName={contactName}
        contactPhone={contactPhone}
      />
    </>
  );
};
