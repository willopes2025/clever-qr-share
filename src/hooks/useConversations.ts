import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Conversation {
  id: string;
  user_id: string;
  contact_id: string;
  instance_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  status: string;
  created_at: string;
  updated_at: string;
  contact?: {
    id: string;
    name: string | null;
    phone: string;
  };
}

export interface InboxMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  message_type: string;
  media_url: string | null;
  status: string;
  whatsapp_message_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

export const useConversations = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: conversations, isLoading, refetch } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          contact:contacts(id, name, phone)
        `)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      return data as Conversation[];
    },
    enabled: !!user,
  });

  const createConversation = useMutation({
    mutationFn: async ({ contactId, instanceId }: { contactId: string; instanceId?: string }) => {
      const { data, error } = await supabase
        .from('conversations')
        .upsert({
          user_id: user!.id,
          contact_id: contactId,
          instance_id: instanceId || null,
        }, { onConflict: 'user_id,contact_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar conversa: " + error.message);
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  return {
    conversations,
    isLoading,
    refetch,
    createConversation,
    markAsRead,
  };
};

export const useMessages = (conversationId: string | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: messages, isLoading, refetch } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase
        .from('inbox_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true });

      if (error) throw error;
      return data as InboxMessage[];
    },
    enabled: !!conversationId && !!user,
  });

  const sendMessage = useMutation({
    mutationFn: async ({ content, conversationId }: { content: string; conversationId: string }) => {
      const { data, error } = await supabase
        .from('inbox_messages')
        .insert({
          conversation_id: conversationId,
          user_id: user!.id,
          direction: 'outbound',
          content,
          message_type: 'text',
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation preview
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: content.substring(0, 100),
        })
        .eq('id', conversationId);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao enviar mensagem: " + error.message);
    },
  });

  return {
    messages,
    isLoading,
    refetch,
    sendMessage,
  };
};
