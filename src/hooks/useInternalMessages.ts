import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useEffect } from "react";

export interface InternalMessage {
  id: string;
  user_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  content: string;
  mentions: string[];
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export const useInternalMessages = (conversationId: string | null, contactId: string | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading, refetch } = useQuery({
    queryKey: ['internal-messages', conversationId, contactId],
    queryFn: async () => {
      if (!conversationId && !contactId) return [];
      
      let query = supabase
        .from('internal_messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (conversationId) {
        query = query.eq('conversation_id', conversationId);
      } else if (contactId) {
        query = query.eq('contact_id', contactId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch profiles separately
      const userIds = [...new Set(data.map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return data.map(m => ({
        ...m,
        profile: profileMap.get(m.user_id) || null,
      })) as InternalMessage[];
    },
    enabled: !!(conversationId || contactId),
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!conversationId && !contactId) return;

    const channel = supabase
      .channel(`internal-messages-${conversationId || contactId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_messages',
          filter: conversationId 
            ? `conversation_id=eq.${conversationId}` 
            : `contact_id=eq.${contactId}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, contactId, refetch]);

  const sendMessage = useMutation({
    mutationFn: async ({ content, mentions = [] }: { content: string; mentions?: string[] }) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('internal_messages')
        .insert({
          user_id: user.id,
          conversation_id: conversationId,
          contact_id: contactId,
          content,
          mentions,
        })
        .select(`
          *,
          profile:profiles(full_name, avatar_url)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-messages', conversationId, contactId] });
    },
    onError: (error) => {
      console.error('Error sending internal message:', error);
      toast.error('Erro ao enviar mensagem interna');
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('internal_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-messages', conversationId, contactId] });
    },
    onError: (error) => {
      console.error('Error deleting message:', error);
      toast.error('Erro ao excluir mensagem');
    },
  });

  return {
    messages,
    isLoading,
    sendMessage,
    deleteMessage,
  };
};
