import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Merge, MessageCircle, Calendar } from "lucide-react";
import { useConversationActions } from "@/hooks/useConversationActions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MergeConversationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  contactName: string;
  contactPhone: string;
  onMerged?: () => void;
}

export const MergeConversationsDialog = ({
  open,
  onOpenChange,
  conversationId,
  contactName,
  contactPhone,
  onMerged,
}: MergeConversationsDialogProps) => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const { mergeConversations } = useConversationActions();

  // Find duplicate conversations for same contact name or phone
  const { data: duplicates, isLoading } = useQuery({
    queryKey: ['duplicate-conversations', conversationId, contactName, contactPhone],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Search by phone (exact) or name (similar)
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select(`
          id, status, created_at, last_message_at, unread_count, provider,
          contact:contacts!inner(id, name, phone)
        `)
        .neq('id', conversationId)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Filter for matching contacts
      return (conversations || []).filter((conv: any) => {
        const name = conv.contact?.name?.toLowerCase() || '';
        const phone = conv.contact?.phone || '';
        const searchName = contactName.toLowerCase();
        
        // Match by phone or similar name
        return phone === contactPhone || 
               (searchName.length > 3 && name.includes(searchName)) ||
               (name.length > 3 && searchName.includes(name));
      });
    },
    enabled: open,
  });

  const handleMerge = () => {
    if (!selectedConversationId) return;
    mergeConversations.mutate(
      { keepConversationId: conversationId, mergeConversationId: selectedConversationId },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedConversationId(null);
          onMerged?.();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Unificar Conversas
          </DialogTitle>
          <DialogDescription>
            Selecione a conversa duplicada para unificar com a conversa atual de <strong>{contactName}</strong>. 
            Todas as mensagens, notas e tarefas serão movidas para esta conversa.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[300px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">Buscando conversas duplicadas...</div>
          ) : !duplicates?.length ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nenhuma conversa duplicada encontrada para este contato.
            </div>
          ) : (
            <div className="space-y-2 p-1">
              {duplicates.map((conv: any) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-colors",
                    selectedConversationId === conv.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{conv.contact?.name || 'Sem nome'}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {conv.status === 'archived' ? 'Arquivada' : conv.status === 'closed' ? 'Fechada' : 'Ativa'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{conv.contact?.phone}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {conv.last_message_at 
                        ? format(new Date(conv.last_message_at), "dd/MM/yy HH:mm", { locale: ptBR })
                        : 'Sem mensagens'}
                    </span>
                    {conv.unread_count > 0 && (
                      <Badge className="h-4 px-1 text-[10px]">{conv.unread_count}</Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!selectedConversationId || mergeConversations.isPending}
          >
            <Merge className="h-4 w-4 mr-2" />
            {mergeConversations.isPending ? 'Unificando...' : 'Unificar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
