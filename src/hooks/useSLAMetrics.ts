import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useOrganization } from "./useOrganization";

export interface SLAMetric {
  id: string;
  user_id: string;
  organization_id: string | null;
  metric_date: string;
  conversations_received: number;
  conversations_responded: number;
  total_first_response_seconds: number;
  avg_first_response_seconds: number;
  sla_breached_15min: number;
  sla_breached_1h: number;
  sla_breached_24h: number;
}

export interface UnrespondedConversation {
  id: string;
  contact_id: string;
  contact_name: string | null;
  contact_phone: string;
  last_message_at: string;
  last_message_preview: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  minutes_waiting: number;
  urgency: 'critical' | 'alert' | 'attention' | 'ok';
}

export interface DealWithoutNextAction {
  id: string;
  title: string | null;
  contact_name: string | null;
  contact_phone: string;
  stage_name: string;
  funnel_name: string;
  days_without_action: number;
}

export function useSLAMetrics() {
  const { user } = useAuth();
  const { organization } = useOrganization();

  // Fetch SLA metrics for organization members
  const { data: slaByMember, isLoading: isLoadingSLA } = useQuery({
    queryKey: ['sla-metrics', organization?.id],
    queryFn: async () => {
      if (!organization) return [];

      // Get team members
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('organization_id', organization.id)
        .eq('status', 'active');

      if (!members) return [];

      const userIds = members.filter(m => m.user_id).map(m => m.user_id);
      if (userIds.length === 0) return [];

      // Get profiles for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds as string[]);

      // Get today's SLA metrics
      const today = new Date().toISOString().split('T')[0];
      const { data: metrics } = await supabase
        .from('sla_metrics')
        .select('*')
        .in('user_id', userIds as string[])
        .eq('metric_date', today);

      return members.filter(m => m.user_id).map(m => {
        const profile = profiles?.find(p => p.id === m.user_id);
        const metric = metrics?.find(met => met.user_id === m.user_id);
        return {
          user_id: m.user_id,
          name: profile?.full_name || 'Sem nome',
          conversations_received: metric?.conversations_received || 0,
          conversations_responded: metric?.conversations_responded || 0,
          avg_first_response_seconds: metric?.avg_first_response_seconds || 0,
          sla_breached_15min: metric?.sla_breached_15min || 0,
          sla_breached_1h: metric?.sla_breached_1h || 0,
          sla_breached_24h: metric?.sla_breached_24h || 0,
        };
      });
    },
    enabled: !!organization?.id,
  });

  // Fetch unresponded conversations
  const { data: unrespondedConversations, isLoading: isLoadingUnresponded } = useQuery({
    queryKey: ['unresponded-conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get conversations where last message is inbound and no outbound after
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select(`
          id,
          contact_id,
          last_message_at,
          last_message_preview,
          assigned_to,
          contact:contacts(name, phone)
        `)
        .eq('status', 'open')
        .not('last_message_at', 'is', null)
        .order('last_message_at', { ascending: true });

      if (error || !conversations) return [];

      // Filter for truly unresponded (check last message direction)
      const results: UnrespondedConversation[] = [];

      for (const conv of conversations) {
        // Get the last message
        const { data: lastMessages } = await supabase
          .from('inbox_messages')
          .select('direction, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastMessage = lastMessages?.[0];
        if (!lastMessage || lastMessage.direction !== 'inbound') continue;

        const lastMsgTime = new Date(conv.last_message_at!);
        const now = new Date();
        const minutesWaiting = Math.floor((now.getTime() - lastMsgTime.getTime()) / 60000);

        let urgency: 'critical' | 'alert' | 'attention' | 'ok' = 'ok';
        if (minutesWaiting >= 1440) urgency = 'critical'; // 24h
        else if (minutesWaiting >= 60) urgency = 'alert'; // 1h
        else if (minutesWaiting >= 15) urgency = 'attention'; // 15min

        // Get assignee name if exists
        let assigneeName: string | null = null;
        if (conv.assigned_to) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', conv.assigned_to)
            .single();
          assigneeName = profile?.full_name || null;
        }

        const contact = conv.contact as { name: string | null; phone: string } | null;

        results.push({
          id: conv.id,
          contact_id: conv.contact_id,
          contact_name: contact?.name || null,
          contact_phone: contact?.phone || '',
          last_message_at: conv.last_message_at!,
          last_message_preview: conv.last_message_preview,
          assigned_to: conv.assigned_to,
          assignee_name: assigneeName,
          minutes_waiting: minutesWaiting,
          urgency,
        });
      }

      return results.sort((a, b) => b.minutes_waiting - a.minutes_waiting);
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch deals without next action
  const { data: dealsWithoutAction, isLoading: isLoadingDeals } = useQuery({
    queryKey: ['deals-without-action', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get deals where next_action_required is true
      const { data: deals, error } = await supabase
        .from('funnel_deals')
        .select(`
          id,
          title,
          created_at,
          contact:contacts(name, phone),
          stage:funnel_stages(name),
          funnel:funnels(name)
        `)
        .eq('next_action_required', true)
        .is('closed_at', null)
        .order('created_at', { ascending: true });

      if (error || !deals) return [];

      return deals.map(deal => {
        const contact = deal.contact as { name: string | null; phone: string } | null;
        const stage = deal.stage as { name: string } | null;
        const funnel = deal.funnel as { name: string } | null;
        const createdAt = new Date(deal.created_at);
        const now = new Date();
        const daysWithoutAction = Math.floor((now.getTime() - createdAt.getTime()) / 86400000);

        return {
          id: deal.id,
          title: deal.title,
          contact_name: contact?.name || null,
          contact_phone: contact?.phone || '',
          stage_name: stage?.name || '',
          funnel_name: funnel?.name || '',
          days_without_action: daysWithoutAction,
        } as DealWithoutNextAction;
      });
    },
    enabled: !!user?.id,
  });

  // Summary stats
  const summary = {
    dealsWithoutAction: dealsWithoutAction?.length || 0,
    unrespondedOver15min: unrespondedConversations?.filter(c => c.urgency !== 'ok').length || 0,
    unrespondedOver1h: unrespondedConversations?.filter(c => c.urgency === 'alert' || c.urgency === 'critical').length || 0,
    unrespondedOver24h: unrespondedConversations?.filter(c => c.urgency === 'critical').length || 0,
    avgFirstResponse: slaByMember?.reduce((acc, m) => acc + m.avg_first_response_seconds, 0) / (slaByMember?.length || 1) || 0,
  };

  return {
    slaByMember,
    unrespondedConversations,
    dealsWithoutAction,
    summary,
    isLoading: isLoadingSLA || isLoadingUnresponded || isLoadingDeals,
  };
}
