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
  // Last message direction for "no response" filter
  last_message_direction?: 'inbound' | 'outbound' | null;
  // Provider fields (WhatsApp Lite vs API)
  provider?: 'evolution' | 'meta' | null;
  meta_phone_number_id?: string | null;
  contact?: {
    id: string;
    name: string | null;
    phone: string;
    notes?: string | null;
    custom_fields?: Record<string, any> | null;
    avatar_url?: string | null;
  };
  deal?: ConversationDeal | null;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  emoji: string;
  reacted_by: string;
  created_at: string;
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
  extracted_content?: string | null;
  error_message?: string | null;
  sent_by_user_id?: string | null;
  sent_by_user?: {
    full_name: string | null;
    avatar_url?: string | null;
  } | null;
  // AI fields
  sent_by_ai_agent_id?: string | null;
  is_ai_generated?: boolean;
  ai_agent?: {
    agent_name: string;
  } | null;
  // Origin tracking
  sent_via_instance_id?: string | null;
  sent_via_meta_number_id?: string | null;
  // Reactions
  reactions?: MessageReaction[];
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

  // Page size for the inbox list. Kept smaller than the full data set so
  // the first paint is fast even on accounts with thousands of
  // conversations. The "Não lidas" / "Arquivadas" tabs and search use
  // dedicated queries when needed.
  const INBOX_PAGE_SIZE = 200;

  const { data: conversations, isLoading, refetch } = useQuery({
    queryKey: ['conversations', user?.id, allowedInstanceIds, hasInstanceRestriction, notificationInstanceIds],
    queryFn: async () => {
      // STEP 1 — Light query: only fields needed by the list itself.
      // We deliberately removed the embedded `contact` and
      // `conversation_tag_assignments` joins from this call — embedding
      // those in a single PostgREST request was triggering
      // "canceling statement due to statement timeout" (HTTP 500) on
      // accounts with thousands of conversations. We now fetch contacts
      // and tag assignments separately, in chunks, only for the page we
      // actually render.
      let query = supabase
        .from('conversations')
        .select(`
          id, user_id, contact_id, instance_id,
          last_message_at, last_message_preview, last_message_direction,
          unread_count, status, is_pinned,
          created_at, updated_at,
          campaign_id, ai_handled, ai_paused, ai_handoff_requested,
          ai_handoff_reason, ai_interactions_count,
          assigned_to, first_response_at,
          provider, meta_phone_number_id
        `)
        .order('is_pinned', { ascending: false })
        .order('last_message_at', { ascending: false })
        .limit(INBOX_PAGE_SIZE);

      // Filter by instance IDs if member has instance restrictions.
      // We use a single `.in()` (with a sentinel uuid for null) instead of
      // an `.or(...)` chain because PostgREST's `or()` filter cannot use
      // an index on (instance_id, last_message_at) and was a major cause
      // of statement timeouts on large datasets.
      if (hasInstanceRestriction && allowedInstanceIds !== undefined) {
        if (allowedInstanceIds.length > 0) {
          query = query.or(`instance_id.in.(${allowedInstanceIds.join(',')}),instance_id.is.null`);
        } else {
          query = query.is('instance_id', null);
        }
      }

      // Notification-only instances: NÃO filtramos no servidor porque
      // PostgREST traduz `not.in` para SQL `NOT IN (...)`, que em Postgres
      // descarta linhas com `instance_id IS NULL` (NULL NOT IN (...) → NULL → falso).
      // Isso fazia conversas órfãs (sem instância) sumirem do inbox.
      // Filtramos client-side abaixo, depois do fetch, preservando o índice
      // (is_pinned, last_message_at) usado pela query principal.

      const { data, error } = await query;
      if (error) throw error;

      const notifSet = new Set(notificationInstanceIds || []);
      const rawRows = ((data as any[]) || []).filter(
        (r) => !r.instance_id || !notifSet.has(r.instance_id)
      );
      const rows = rawRows;
      const conversationIds = rows.map(r => r.id);
      const contactIds = Array.from(new Set(rows.map(r => r.contact_id).filter(Boolean)));

      // STEP 2 — Fetch contacts (just what the list needs) in chunks.
      const contactsMap: Record<string, any> = {};
      if (contactIds.length > 0) {
        const CHUNK = 200;
        for (let i = 0; i < contactIds.length; i += CHUNK) {
          const slice = contactIds.slice(i, i + CHUNK);
          const { data: cs } = await supabase
            .from('contacts')
            .select('id, name, phone, avatar_url, contact_display_id, notes, custom_fields')
            .in('id', slice);
          if (cs) {
            for (const c of cs as any[]) contactsMap[c.id] = c;
          }
        }
      }

      // STEP 3 — Fetch tag assignments for the visible conversations only.
      const tagsMap: Record<string, { tag_id: string }[]> = {};
      if (conversationIds.length > 0) {
        const CHUNK = 200;
        for (let i = 0; i < conversationIds.length; i += CHUNK) {
          const slice = conversationIds.slice(i, i + CHUNK);
          const { data: tagRows } = await supabase
            .from('conversation_tag_assignments')
            .select('conversation_id, tag_id')
            .in('conversation_id', slice);
          if (tagRows) {
            for (const t of tagRows as any[]) {
              if (!tagsMap[t.conversation_id]) tagsMap[t.conversation_id] = [];
              tagsMap[t.conversation_id].push({ tag_id: t.tag_id });
            }
          }
        }
      }

      // STEP 4 — Fetch open deals for visible contacts only.
      const dealsMap: Record<string, ConversationDeal> = {};
      if (contactIds.length > 0) {
        const CHUNK = 200;
        for (let i = 0; i < contactIds.length; i += CHUNK) {
          const slice = contactIds.slice(i, i + CHUNK);
          const { data: deals } = await supabase
            .from('funnel_deals')
            .select(`
              id, contact_id, stage_id, funnel_id,
              funnel:funnels(name),
              stage:funnel_stages(name, color)
            `)
            .is('closed_at', null)
            .in('contact_id', slice);

          if (deals) {
            for (const deal of deals as any[]) {
              if (deal.contact_id && !dealsMap[deal.contact_id]) {
                dealsMap[deal.contact_id] = {
                  id: deal.id,
                  stage_id: deal.stage_id,
                  funnel_id: deal.funnel_id,
                  funnel_name: deal.funnel?.name || null,
                  stage_name: deal.stage?.name || null,
                  stage_color: deal.stage?.color || null,
                };
              }
            }
          }
        }
      }

      // Filter out "ghost" conversations (created via "Nova Conversa" but
      // never had a message exchanged AND no real contact name).
      const cleaned = rows.filter((conv: any) => {
        const hasPreview = !!conv.last_message_preview;
        const hasDirection = !!conv.last_message_direction;
        const contact = contactsMap[conv.contact_id];
        const contactName = (contact?.name || '').trim();
        return hasPreview || hasDirection || contactName.length > 0;
      });

      return cleaned.map((conv: any) => ({
        ...conv,
        contact: contactsMap[conv.contact_id] || null,
        tag_assignments: tagsMap[conv.id] || [],
        deal: dealsMap[conv.contact_id] || null,
      })) as (Conversation & { tag_assignments?: { tag_id: string }[] })[];
    },
    enabled: !!user && (hasInstanceRestriction === false || allowedInstanceIds !== undefined),
    staleTime: 15_000,
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

      // Stamp read_at on unread inbound messages in the background (non-blocking)
      const now = new Date().toISOString();
      supabase
        .from('inbox_messages')
        .update({ read_at: now })
        .eq('conversation_id', conversationId)
        .eq('direction', 'inbound')
        .is('read_at', null)
        .then(({ error: msgError }) => {
          if (msgError) console.error('[markAsRead] Failed to stamp message read_at:', msgError.message);
        });
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
      
      // Get unique sender IDs (users)
      const senderIds = [...new Set(
        messagesData
          ?.filter(m => m.sent_by_user_id)
          .map(m => m.sent_by_user_id) || []
      )] as string[];

      // Get unique AI agent IDs
      const aiAgentIds = [...new Set(
        messagesData
          ?.filter(m => m.sent_by_ai_agent_id)
          .map(m => m.sent_by_ai_agent_id) || []
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

      // Fetch AI agent names if any
      let aiAgentsMap: Record<string, { agent_name: string }> = {};

      if (aiAgentIds.length > 0) {
        const { data: agents } = await supabase
          .from('ai_agent_configs')
          .select('id, agent_name')
          .in('id', aiAgentIds);

        if (agents) {
          aiAgentsMap = agents.reduce((acc, a) => {
            acc[a.id] = { agent_name: a.agent_name };
            return acc;
          }, {} as Record<string, { agent_name: string }>);
        }
      }
      
      // Fetch reactions for all messages in this conversation
      const { data: reactionsData } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('conversation_id', conversationId);
      
      const reactionsMap: Record<string, MessageReaction[]> = {};
      if (reactionsData) {
        for (const r of reactionsData) {
          if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = [];
          reactionsMap[r.message_id].push(r as MessageReaction);
        }
      }
      
      // Map messages with sender info and reactions
      return messagesData?.map(msg => ({
        ...msg,
        direction: msg.direction as 'inbound' | 'outbound',
        sent_by_user: msg.sent_by_user_id ? profilesMap[msg.sent_by_user_id] || null : null,
        ai_agent: msg.sent_by_ai_agent_id ? aiAgentsMap[msg.sent_by_ai_agent_id] || null : null,
        reactions: reactionsMap[msg.id] || [],
      })) as InboxMessage[];
    },
    enabled: !!conversationId && !!user,
  });

  const sendMessage = useMutation({
    mutationFn: async ({ content, conversationId, instanceId, messageType, metaTemplate, targetPhone }: { content: string; conversationId: string; instanceId: string; messageType?: string; metaTemplate?: any; targetPhone?: string }) => {
      const { data, error } = await supabase.functions.invoke('send-inbox-message', {
        body: {
          conversationId,
          content,
          instanceId,
          ...(messageType && { messageType }),
          ...(metaTemplate && { metaTemplate }),
          ...(targetPhone && { targetPhone }),
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
      caption,
      targetPhone 
    }: { 
      conversationId: string; 
      instanceId: string; 
      mediaUrl: string; 
      mediaType: 'image' | 'document' | 'audio' | 'video';
      caption?: string;
      targetPhone?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('send-inbox-media', {
        body: {
          conversationId,
          instanceId,
          mediaUrl,
          mediaType,
          caption,
          ...(targetPhone && { targetPhone }),
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

  const sendReaction = useMutation({
    mutationFn: async ({ messageId, emoji, conversationId: convId, instanceId: instId }: { messageId: string; emoji: string; conversationId: string; instanceId?: string }) => {
      const { data, error } = await supabase.functions.invoke('send-inbox-message', {
        body: {
          conversationId: convId,
          action: 'reaction',
          messageId,
          emoji,
          instanceId: instId,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to send reaction');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao enviar reação: " + error.message);
    },
  });

  return {
    messages,
    isLoading,
    refetch,
    sendMessage,
    sendMediaMessage,
    transcribeAudio,
    sendReaction,
  };
};
