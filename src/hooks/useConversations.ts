import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ConversationDeal {
  id: string;
  stage_id: string;
  funnel_id: string;
  funnel_name: string | null;
  stage_name: string | null;
  stage_color: string | null;
}

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
  // AI Agent fields
  campaign_id?: string | null;
  ai_handled?: boolean | null;
  ai_paused?: boolean | null;
  ai_handoff_requested?: boolean | null;
  ai_handoff_reason?: string | null;
  ai_interactions_count?: number | null;
  // FASE 1: Lead distribution + SLA
  assigned_to?: string | null;
  first_response_at?: string | null;
  contact?: {
    id: string;
    name: string | null;
    phone: string;
    notes?: string | null;
    custom_fields?: Record<string, any> | null;
  };
  deal?: ConversationDeal | null;
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
  sent_by_user_id?: string | null;
  sent_by_user?: {
    full_name: string | null;
    avatar_url?: string | null;
  } | null;
}

export const useConversations = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if current user has instance restrictions
  const { data: hasInstanceRestriction } = useQuery({
    queryKey: ['has-instance-restriction', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('member_has_instance_restriction', { _user_id: user!.id });
      
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user,
  });

  // Get member's allowed instance IDs directly
  const { data: allowedInstanceIds } = useQuery({
    queryKey: ['my-instance-ids', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_member_instance_ids', { _user_id: user!.id });
      
      if (error) throw error;
      return data as string[];
    },
    enabled: !!user && hasInstanceRestriction === true,
  });

  // Get notification-only instance IDs to exclude from inbox
  const { data: notificationInstanceIds } = useQuery({
    queryKey: ['notification-instance-ids', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('is_notification_only', true);
      
      if (error) throw error;
      return data?.map(i => i.id) || [];
    },
    enabled: !!user,
  });

  const { data: conversations, isLoading, refetch } = useQuery({
    queryKey: ['conversations', user?.id, allowedInstanceIds, hasInstanceRestriction, notificationInstanceIds],
    queryFn: async () => {
      let query = supabase
        .from('conversations')
        .select(`
          *,
          contact:contacts(id, name, phone, notes, custom_fields),
          tag_assignments:conversation_tag_assignments(tag_id)
        `)
        .order('is_pinned', { ascending: false })
        .order('last_message_at', { ascending: false });

      // Filter by instance IDs if member has instance restrictions
      if (hasInstanceRestriction && allowedInstanceIds !== undefined) {
        if (allowedInstanceIds.length > 0) {
          query = query.in('instance_id', allowedInstanceIds);
        } else {
          // Member has instance restrictions but no instances assigned - return empty
          return [];
        }
      }

      // Exclude conversations from notification-only instances
      if (notificationInstanceIds && notificationInstanceIds.length > 0) {
        query = query.not('instance_id', 'in', `(${notificationInstanceIds.join(',')})`);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch active deals for all contact_ids to show funnel/stage info
      const contactIds = data?.map(c => c.contact_id).filter(Boolean) || [];
      
      let dealsMap: Record<string, ConversationDeal> = {};
      
      if (contactIds.length > 0) {
        const { data: deals } = await supabase
          .from('funnel_deals')
          .select(`
            id,
            contact_id,
            stage_id,
            funnel_id,
            funnel:funnels(name),
            stage:funnel_stages(name, color)
          `)
          .in('contact_id', contactIds)
          .is('closed_at', null);
        
        if (deals) {
          deals.forEach((deal: any) => {
            if (deal.contact_id) {
              dealsMap[deal.contact_id] = {
                id: deal.id,
                stage_id: deal.stage_id,
                funnel_id: deal.funnel_id,
                funnel_name: deal.funnel?.name || null,
                stage_name: deal.stage?.name || null,
                stage_color: deal.stage?.color || null,
              };
            }
          });
        }
      }
      
      // Map deals to conversations
      return data?.map(conv => ({
        ...conv,
        deal: dealsMap[conv.contact_id] || null,
      })) as (Conversation & { tag_assignments?: { tag_id: string }[] })[];
    },
    enabled: !!user && (hasInstanceRestriction === false || allowedInstanceIds !== undefined),
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
    hasInstanceRestriction,
  };
};

export const useMessages = (conversationId: string | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: messages, isLoading, refetch } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      // Fetch messages
      const { data: messagesData, error } = await supabase
        .from('inbox_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Get unique sender IDs
      const senderIds = [...new Set(
        messagesData
          ?.filter(m => m.sent_by_user_id)
          .map(m => m.sent_by_user_id) || []
      )] as string[];
      
      // Fetch profiles for senders if any
      let profilesMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', senderIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
            return acc;
          }, {} as Record<string, { full_name: string | null; avatar_url: string | null }>);
        }
      }
      
      // Map messages with sender info
      return messagesData?.map(msg => ({
        ...msg,
        direction: msg.direction as 'inbound' | 'outbound',
        sent_by_user: msg.sent_by_user_id ? profilesMap[msg.sent_by_user_id] || null : null
      })) as InboxMessage[];
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
