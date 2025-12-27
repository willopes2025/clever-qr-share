import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface ConversationNote {
  id: string;
  user_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export const useConversationNotes = (conversationId: string | null, contactId: string | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['conversation-notes', conversationId, contactId],
    queryFn: async () => {
      if (!conversationId && !contactId) return [];
      
      let query = supabase
        .from('conversation_notes')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (conversationId) {
        query = query.eq('conversation_id', conversationId);
      } else if (contactId) {
        query = query.eq('contact_id', contactId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConversationNote[];
    },
    enabled: !!(conversationId || contactId),
  });

  const createNote = useMutation({
    mutationFn: async ({ content, isPinned = false }: { content: string; isPinned?: boolean }) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('conversation_notes')
        .insert({
          user_id: user.id,
          conversation_id: conversationId,
          contact_id: contactId,
          content,
          is_pinned: isPinned,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-notes', conversationId, contactId] });
      toast.success('Nota criada com sucesso');
    },
    onError: (error) => {
      console.error('Error creating note:', error);
      toast.error('Erro ao criar nota');
    },
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, content, isPinned }: { id: string; content?: string; isPinned?: boolean }) => {
      const updates: Partial<ConversationNote> = {};
      if (content !== undefined) updates.content = content;
      if (isPinned !== undefined) updates.is_pinned = isPinned;

      const { data, error } = await supabase
        .from('conversation_notes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-notes', conversationId, contactId] });
      toast.success('Nota atualizada');
    },
    onError: (error) => {
      console.error('Error updating note:', error);
      toast.error('Erro ao atualizar nota');
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('conversation_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-notes', conversationId, contactId] });
      toast.success('Nota excluída');
    },
    onError: (error) => {
      console.error('Error deleting note:', error);
      toast.error('Erro ao excluir nota');
    },
  });

  return {
    notes,
    isLoading,
    createNote,
    updateNote,
    deleteNote,
  };
};
