import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInboxHiddenInstances } from "@/hooks/useInboxHiddenInstances";
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
  sent_via_chatbot_flow_id?: string | null;
  sent_via_template_id?: string | null;
  sent_via_meta_template_id?: string | null;
  chatbot_flow?: { name: string } | null;
  template?: { name: string } | null;
  meta_template?: { name: string } | null;
  // Reactions
  reactions?: MessageReaction[];
  // Quoted/replied message
  quoted_message?: {
    whatsapp_message_id?: string | null;
    content?: string | null;
    message_type?: string | null;
    from_me?: boolean | null;
    participant?: string | null;
  } | null;
}

export const useConversations = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { hiddenSet: hiddenInstanceSet, hiddenIds: hiddenInstanceIds } = useInboxHiddenInstances();

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

  // Phones used in the chip-warming ecosystem. We hide conversations whose
  // contact phone matches one of these numbers, because the warming pool
  // generates synthetic traffic from multiple instances against shared
  // contacts and the resulting threads pollute the inbox of every chip
  // that ever talked to the same warming number (RLS allows org-wide read,
  // so this set covers all warming numbers visible to the user's org).
  const { data: warmingPhones } = useQuery({
    queryKey: ['warming-phones-set', user?.id],
    queryFn: async () => {
      const set = new Set<string>();
      const [{ data: wc }, { data: wp }] = await Promise.all([
        supabase.from('warming_contacts').select('phone'),
        supabase.from('warming_pool').select('phone_number'),
      ]);
      (wc as { phone: string | null }[] | null)?.forEach((r) => {
        if (r.phone) set.add(r.phone.replace(/\D/g, ''));
      });
      (wp as { phone_number: string | null }[] | null)?.forEach((r) => {
        if (r.phone_number) set.add(r.phone_number.replace(/\D/g, ''));
      });
      return set;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Page size for the inbox list. Kept smaller than the full data set so
  // the first paint is fast even on accounts with thousands of
  // conversations. The "Não lidas" / "Arquivadas" tabs and search use
  // dedicated queries when needed.
  const INBOX_PAGE_SIZE = 200;

  const { data: conversations, isLoading, refetch } = useQuery({
    queryKey: ['conversations', user?.id, allowedInstanceIds, hasInstanceRestriction, notificationInstanceIds, warmingPhones?.size ?? 0, hiddenInstanceIds.join(',')],
    queryFn: async () => {
      // STEP 1 — Light query: only fields needed by the list itself.
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

      if (hasInstanceRestriction && allowedInstanceIds !== undefined) {
        if (allowedInstanceIds.length > 0) {
          query = query.or(`instance_id.in.(${allowedInstanceIds.join(',')}),instance_id.is.null`);
        } else {
          query = query.is('instance_id', null);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const notifSet = new Set(notificationInstanceIds || []);
      const rawRows = ((data as any[]) || []).filter(
        (r) =>
          (!r.instance_id || !notifSet.has(r.instance_id)) &&
          (!r.instance_id || !hiddenInstanceSet.has(r.instance_id))
      );
      const rows = rawRows;
      const conversationIds = rows.map(r => r.id);
      const contactIds = Array.from(new Set(rows.map(r => r.contact_id).filter(Boolean)));

      const CHUNK = 200;

      // STEP 2/3/4 — em PARALELO (eram 3 round-trips sequenciais antes).
      // Cada subtarefa mantém o chunk de 200 do PostgREST, mas a página
      // pinta assim que as três terminam juntas.
      const fetchContacts = async () => {
        const map: Record<string, any> = {};
        if (contactIds.length === 0) return map;
        // Removidos `custom_fields` e `notes` — não são usados pela lista
        // (apenas pelo painel direito, que carrega o contato completo
        // por hook próprio quando a conversa é aberta).
        for (let i = 0; i < contactIds.length; i += CHUNK) {
          const slice = contactIds.slice(i, i + CHUNK);
          const { data: cs } = await supabase
            .from('contacts')
            .select('id, name, phone, avatar_url, contact_display_id')
            .in('id', slice);
          if (cs) for (const c of cs as any[]) map[c.id] = c;
        }
        return map;
      };

      const fetchTags = async () => {
        const map: Record<string, { tag_id: string }[]> = {};
        if (conversationIds.length === 0) return map;
        for (let i = 0; i < conversationIds.length; i += CHUNK) {
          const slice = conversationIds.slice(i, i + CHUNK);
          const { data: tagRows } = await supabase
            .from('conversation_tag_assignments')
            .select('conversation_id, tag_id')
            .in('conversation_id', slice);
          if (tagRows) {
            for (const t of tagRows as any[]) {
              if (!map[t.conversation_id]) map[t.conversation_id] = [];
              map[t.conversation_id].push({ tag_id: t.tag_id });
            }
          }
        }
        return map;
      };

      const fetchDeals = async () => {
        const map: Record<string, ConversationDeal> = {};
        if (contactIds.length === 0) return map;
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
              if (deal.contact_id && !map[deal.contact_id]) {
                map[deal.contact_id] = {
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
        return map;
      };

      const [contactsMap, tagsMap, dealsMap] = await Promise.all([
        fetchContacts(),
        fetchTags(),
        fetchDeals(),
      ]);

      const cleaned = rows.filter((conv: any) => {
        const hasPreview = !!conv.last_message_preview;
        const hasDirection = !!conv.last_message_direction;
        const contact = contactsMap[conv.contact_id];
        const contactName = (contact?.name || '').trim();
        if (!(hasPreview || hasDirection || contactName.length > 0)) return false;
        const phoneDigits = (contact?.phone || '').replace(/\D/g, '');
        if (phoneDigits && warmingPhones?.has(phoneDigits)) return false;
        return true;
      });

      return cleaned.map((conv: any) => ({
        ...conv,
        contact: contactsMap[conv.contact_id] || null,
        tag_assignments: tagsMap[conv.id] || [],
        deal: dealsMap[conv.contact_id] || null,
      })) as (Conversation & { tag_assignments?: { tag_id: string }[] })[];
    },
    // Dispara assim que o usuário estiver pronto. Quando
    // `hasInstanceRestriction` chegar depois, o queryKey muda e o React Query
    // refaz automaticamente — mas a primeira tela já pinta sem esperar a
    // round-trip de gating.
    enabled: !!user,
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
      
      // Fetch latest messages first to avoid Supabase's default 1000-row cap
      // showing only the oldest history in long conversations.
      const { data: messagesData, error } = await supabase
        .from('inbox_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const orderedMessages = [...(messagesData || [])].reverse();
      
      // Get unique sender IDs (users)
      const senderIds = [...new Set(
        orderedMessages
          ?.filter(m => m.sent_by_user_id)
          .map(m => m.sent_by_user_id) || []
      )] as string[];

      // Get unique AI agent IDs
      const aiAgentIds = [...new Set(
        orderedMessages
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
      return orderedMessages.map(msg => ({
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
    mutationFn: async ({ content, conversationId, instanceId, messageType, metaTemplate, targetPhone, quotedMessage }: { content: string; conversationId: string; instanceId: string; messageType?: string; metaTemplate?: any; targetPhone?: string; quotedMessage?: { id: string; whatsapp_message_id: string | null; content: string | null; message_type: string | null; from_me: boolean; participant?: string | null } }) => {
      const { data, error } = await supabase.functions.invoke('send-inbox-message', {
        body: {
          conversationId,
          content,
          instanceId,
          ...(messageType && { messageType }),
          ...(metaTemplate && { metaTemplate }),
          ...(targetPhone && { targetPhone }),
          ...(quotedMessage && { quotedMessage }),
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
