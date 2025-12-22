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
  is_pinned: boolean | null;
  created_at: string;
  updated_at: string;
  contact?: {
    id: string;
    name: string | null;
    phone: string;
    notes?: string | null;
    custom_fields?: Record<string, any> | null;
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
  transcription?: string | null;
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
          contact:contacts(id, name, phone, notes, custom_fields)
        `)
        .order('is_pinned', { ascending: false })
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
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as InboxMessage[];
    },
    enabled: !!conversationId && !!user,
  });

  const sendMessage = useMutation({
    mutationFn: async ({ content, conversationId, instanceId }: { content: string; conversationId: string; instanceId: string }) => {
      const { data, error } = await supabase.functions.invoke('send-inbox-message', {
        body: {
          conversationId,
          content,
          instanceId,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to send message');

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

  const sendMediaMessage = useMutation({
    mutationFn: async ({ 
      conversationId, 
      instanceId, 
      mediaUrl, 
      mediaType, 
      caption 
    }: { 
      conversationId: string; 
      instanceId: string; 
      mediaUrl: string; 
      mediaType: 'image' | 'document' | 'audio' | 'video';
      caption?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('send-inbox-media', {
        body: {
          conversationId,
          instanceId,
          mediaUrl,
          mediaType,
          caption,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to send media');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao enviar mídia: " + error.message);
    },
  });

  const transcribeAudio = useMutation({
    mutationFn: async ({ messageId, audioUrl }: { messageId: string; audioUrl: string }) => {
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { messageId, audioUrl },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to transcribe audio');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao transcrever áudio: " + error.message);
    },
  });

  return {
    messages,
    isLoading,
    refetch,
    sendMessage,
    sendMediaMessage,
    transcribeAudio,
  };
};
