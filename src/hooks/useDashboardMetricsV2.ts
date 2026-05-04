import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays, subHours, differenceInMinutes } from 'date-fns';

export type DateRange = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface DateRangeResult {
  start: Date;
  end: Date;
}

export interface CustomDateRange {
  from: Date;
  to: Date;
}

export const getDateRange = (range: DateRange, customRange?: CustomDateRange): DateRangeResult => {
  const end = new Date();
  let start: Date;

  if (range === 'custom' && customRange) {
    return {
      start: startOfDay(customRange.from),
      end: new Date(customRange.to.getFullYear(), customRange.to.getMonth(), customRange.to.getDate(), 23, 59, 59, 999),
    };
  }
  
  switch (range) {
    case 'today':
      start = startOfDay(end);
      break;
    case '7d':
      start = subDays(end, 7);
      break;
    case '30d':
      start = subDays(end, 30);
      break;
    case '90d':
      start = subDays(end, 90);
      break;
    default:
      start = subDays(end, 7);
  }
  
  return { start, end };
};

// ==================== OVERVIEW METRICS ====================
export interface OverviewMetrics {
  leadsToday: number;
  activeConversations: number;
  autoAttendances: number;
  humanAttendances: number;
  unansweredLeads: number;
  avgFirstResponseTime: number;
  responseRate: number;
}

export const useOverviewMetrics = (dateRange: DateRange = 'today', customRange?: CustomDateRange) => {
  return useQuery({
    queryKey: ['overview-metrics', dateRange, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async (): Promise<OverviewMetrics> => {
      const { start, end } = getDateRange(dateRange, customRange);
      
      const { count: leadsToday } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      // Active conversations within selected period
      const { count: activeConversations } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .gte('last_message_at', start.toISOString())
        .lte('last_message_at', end.toISOString());

      const { count: autoAttendances } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('ai_handled', true)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const { count: humanAttendances } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('ai_handled', false)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const totalConversationsCount = (autoAttendances || 0) + (humanAttendances || 0);

      const { count: unansweredLeads } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .gt('unread_count', 0)
        .eq('status', 'open');

      // Count distinct conversations with at least 1 outbound message in the period
      const { count: respondedConversations } = await supabase
        .from('inbox_messages')
        .select('conversation_id', { count: 'exact', head: true })
        .eq('direction', 'outbound')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const responseRate = totalConversationsCount > 0 ? ((respondedConversations || 0) / totalConversationsCount) * 100 : 0;

      // Still fetch a sample for avg response time calculation
      const { data: messagesData } = await supabase
        .from('inbox_messages')
        .select('conversation_id, direction, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true })
        .limit(5000);

      let totalResponseTime = 0;
      let responseCount = 0;
      
      if (messagesData) {
        const conversationMessages = new Map<string, { inbound?: Date; outbound?: Date }>();
        
        for (const msg of messagesData) {
          const convId = msg.conversation_id;
          if (!convId) continue;
          
          if (!conversationMessages.has(convId)) {
            conversationMessages.set(convId, {});
          }
          
          const conv = conversationMessages.get(convId)!;
          const msgDate = new Date(msg.created_at);
          
          if (msg.direction === 'inbound' && !conv.inbound) {
            conv.inbound = msgDate;
          } else if (msg.direction === 'outbound' && conv.inbound && !conv.outbound) {
            conv.outbound = msgDate;
            const responseTime = differenceInMinutes(conv.outbound, conv.inbound);
            if (responseTime >= 0 && responseTime < 1440) {
              totalResponseTime += responseTime * 60;
              responseCount++;
            }
          }
        }
      }

      const avgFirstResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

      return {
        leadsToday: leadsToday || 0,
        activeConversations: activeConversations || 0,
        autoAttendances: autoAttendances || 0,
        humanAttendances: humanAttendances || 0,
        unansweredLeads: unansweredLeads || 0,
        avgFirstResponseTime,
        responseRate,
      };
    },
  });
};

// ==================== WHATSAPP METRICS ====================
export interface WhatsAppMetrics {
  messagesSent: number;
  messagesDelivered: number;
  messagesFailed: number;
  deliveryRate: number;
  messagesByInstance: Array<{ instanceId: string; instanceName: string; count: number }>;
  activeChips: number;
  inactiveChips: number;
}

export const useWhatsAppMetrics = (dateRange: DateRange = '7d', customRange?: CustomDateRange) => {
  return useQuery({
    queryKey: ['whatsapp-metrics', dateRange, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async (): Promise<WhatsAppMetrics> => {
      const { start, end } = getDateRange(dateRange, customRange);

      // Count sent, delivered, failed in parallel
      const [sentResult, deliveredResult, failedResult] = await Promise.all([
        supabase
          .from('inbox_messages')
          .select('*', { count: 'exact', head: true })
          .eq('direction', 'outbound')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString()),
        supabase
          .from('inbox_messages')
          .select('*', { count: 'exact', head: true })
          .eq('direction', 'outbound')
          .in('status', ['delivered', 'received', 'read'])
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString()),
        supabase
          .from('inbox_messages')
          .select('*', { count: 'exact', head: true })
          .eq('direction', 'outbound')
          .eq('status', 'failed')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString()),
      ]);

      const messagesSent = sentResult.count || 0;
      const messagesDelivered = deliveredResult.count || 0;
      const messagesFailed = failedResult.count || 0;
      const deliveryRate = messagesSent > 0 ? (messagesDelivered / messagesSent) * 100 : 0;

      // Fetch messages with conversation details including provider and meta_phone_number_id
      const { data: messagesData } = await supabase
        .from('inbox_messages')
        .select('conversation_id')
        .eq('direction', 'outbound')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .limit(5000);

      const conversationIds = [...new Set(messagesData?.map(m => m.conversation_id).filter(Boolean) || [])];
      
      // Fetch conversations with provider info to distinguish Evolution vs Meta
      const { data: conversationsData } = await supabase
        .from('conversations')
        .select('id, instance_id, provider, meta_phone_number_id')
        .in('id', conversationIds.length > 0 ? conversationIds : ['']);

      // Group messages by chip: Evolution instances + Meta phone numbers
      const chipCounts = new Map<string, number>();
      messagesData?.forEach(m => {
        const conv = conversationsData?.find(c => c.id === m.conversation_id);
        if (!conv) return;
        
        if (conv.provider === 'meta' && conv.meta_phone_number_id) {
          // Meta conversations: group by meta_phone_number_id
          const key = `meta:${conv.meta_phone_number_id}`;
          chipCounts.set(key, (chipCounts.get(key) || 0) + 1);
        } else if (conv.instance_id) {
          // Evolution conversations: group by instance_id
          const key = `evo:${conv.instance_id}`;
          chipCounts.set(key, (chipCounts.get(key) || 0) + 1);
        }
      });

      // Fetch Evolution instances and Meta numbers in parallel
      const [instancesResult, metaNumbersResult] = await Promise.all([
        supabase.from('whatsapp_instances').select('id, instance_name, status'),
        supabase.from('meta_whatsapp_numbers').select('id, phone_number_id, display_name'),
      ]);

      const instances = instancesResult.data || [];
      const metaNumbers = metaNumbersResult.data || [];

      const messagesByInstance = Array.from(chipCounts.entries())
        .map(([key, count]) => {
          if (key.startsWith('meta:')) {
            const phoneNumberId = key.replace('meta:', '');
            const metaNum = metaNumbers.find(mn => mn.phone_number_id === phoneNumberId);
            return {
              instanceId: key,
              instanceName: metaNum?.display_name ? `📱 ${metaNum.display_name}` : `Meta ${phoneNumberId.slice(-4)}`,
              count,
            };
          } else {
            const instanceId = key.replace('evo:', '');
            const instance = instances.find(i => i.id === instanceId);
            return {
              instanceId: key,
              instanceName: instance?.instance_name || 'Desconhecido',
              count,
            };
          }
        })
        .sort((a, b) => b.count - a.count);

      // Active/inactive chips: Evolution instances + Meta numbers count as active chips
      const activeEvolution = instances.filter(i => i.status === 'connected').length;
      const inactiveEvolution = instances.filter(i => i.status !== 'connected').length;
      // Meta numbers are always "active" if they exist and have messages
      const activeMetaCount = new Set(
        Array.from(chipCounts.keys()).filter(k => k.startsWith('meta:'))
      ).size;

      const activeChips = activeEvolution + activeMetaCount;
      const inactiveChips = inactiveEvolution;

      return {
        messagesSent,
        messagesDelivered,
        messagesFailed,
        deliveryRate,
        messagesByInstance,
        activeChips,
        inactiveChips,
      };
    },
  });
};

// ==================== LEAD METRICS ====================
export interface LeadMetrics {
  leadsPeriod: number;
  leadsBySource: Array<{ source: string; count: number }>;
  duplicateLeads: number;
  reactivatedLeads: number;
}

export const useLeadMetrics = (dateRange: DateRange = '7d', customRange?: CustomDateRange) => {
  return useQuery({
    queryKey: ['lead-metrics', dateRange, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async (): Promise<LeadMetrics> => {
      const { start, end } = getDateRange(dateRange, customRange);

      // Leads in selected period
      const { count: leadsPeriod } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      // Leads by source filtered by period
      const { data: dealsData } = await supabase
        .from('funnel_deals')
        .select('source')
        .not('source', 'is', null)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const sourceCounts = new Map<string, number>();
      dealsData?.forEach(d => {
        if (d.source) {
          sourceCounts.set(d.source, (sourceCounts.get(d.source) || 0) + 1);
        }
      });

      const leadsBySource = Array.from(sourceCounts.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

      // Duplicate leads in period
      const { data: contacts } = await supabase
        .from('contacts')
        .select('phone')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const phoneCounts = new Map<string, number>();
      contacts?.forEach(c => {
        phoneCounts.set(c.phone, (phoneCounts.get(c.phone) || 0) + 1);
      });
      const duplicateLeads = Array.from(phoneCounts.values()).filter(count => count > 1).length;

      // Reactivated leads in period
      const { count: reactivatedLeads } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .lt('updated_at', start.toISOString())
        .gte('last_message_at', start.toISOString())
        .lte('last_message_at', end.toISOString());

      return {
        leadsPeriod: leadsPeriod || 0,
        leadsBySource,
        duplicateLeads,
        reactivatedLeads: reactivatedLeads || 0,
      };
    },
  });
};

// ==================== LEAD CHANNEL METRICS ====================
export interface LeadChannelData {
  channel: string;
  count: number;
  icon: string;
  details?: Array<{ name: string; count: number }>;
}

export interface LeadChannelMetrics {
  totalLeads: number;
  channels: LeadChannelData[];
}

export const useLeadChannelMetrics = (dateRange: DateRange = '7d', customRange?: CustomDateRange) => {
  return useQuery({
    queryKey: ['lead-channel-metrics', dateRange, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async (): Promise<LeadChannelMetrics> => {
      const { start, end } = getDateRange(dateRange, customRange);

      // Get contacts created in period
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .limit(5000);

      const contactIds = contacts?.map(c => c.id) || [];
      const totalLeads = contactIds.length;

      if (contactIds.length === 0) {
        return { totalLeads: 0, channels: [] };
      }

      // Get conversations for these contacts to determine channel
      const { data: conversations } = await supabase
        .from('conversations')
        .select('contact_id, provider, instance_id, meta_phone_number_id')
        .in('contact_id', contactIds.slice(0, 500));

      // Get form submissions for these contacts
      const { data: formSubmissions } = await supabase
        .from('form_submissions')
        .select('contact_id, form_id')
        .in('contact_id', contactIds.slice(0, 500));

      // Get form names
      const formIds = [...new Set(formSubmissions?.map(fs => fs.form_id).filter(Boolean) || [])];
      const { data: forms } = await supabase
        .from('forms')
        .select('id, name')
        .in('id', formIds.length > 0 ? formIds : ['']);

      // Classify each contact
      const channelCounts = new Map<string, number>();
      const formDetailCounts = new Map<string, number>();
      const contactChannelMap = new Set<string>();

      // Form submissions
      formSubmissions?.forEach(fs => {
        if (fs.contact_id && !contactChannelMap.has(fs.contact_id)) {
          contactChannelMap.add(fs.contact_id);
          channelCounts.set('Formulário', (channelCounts.get('Formulário') || 0) + 1);
          const form = forms?.find(f => f.id === fs.form_id);
          const formName = form?.name || 'Sem nome';
          formDetailCounts.set(formName, (formDetailCounts.get(formName) || 0) + 1);
        }
      });

      // Conversations
      conversations?.forEach(conv => {
        if (!conv.contact_id || contactChannelMap.has(conv.contact_id)) return;
        contactChannelMap.add(conv.contact_id);

        if (conv.provider === 'meta' && conv.meta_phone_number_id) {
          channelCounts.set('WhatsApp Meta', (channelCounts.get('WhatsApp Meta') || 0) + 1);
        } else if (conv.instance_id) {
          channelCounts.set('WhatsApp Evolution', (channelCounts.get('WhatsApp Evolution') || 0) + 1);
        }
      });

      // Remaining contacts without conversation or form = Manual/Import
      contactIds.forEach(id => {
        if (!contactChannelMap.has(id)) {
          channelCounts.set('Manual/Importação', (channelCounts.get('Manual/Importação') || 0) + 1);
        }
      });

      const channels: LeadChannelData[] = Array.from(channelCounts.entries())
        .map(([channel, count]) => {
          const iconMap: Record<string, string> = {
            'WhatsApp Meta': '📱',
            'WhatsApp Evolution': '💬',
            'Formulário': '📋',
            'Instagram': '📸',
            'Email': '📧',
            'Manual/Importação': '📥',
          };
          const result: LeadChannelData = {
            channel,
            count,
            icon: iconMap[channel] || '📊',
          };
          if (channel === 'Formulário') {
            result.details = Array.from(formDetailCounts.entries())
              .map(([name, count]) => ({ name, count }))
              .sort((a, b) => b.count - a.count);
          }
          return result;
        })
        .sort((a, b) => b.count - a.count);

      return { totalLeads, channels };
    },
  });
};

// ==================== CAMPAIGN DISPATCH METRICS ====================
export interface CampaignDispatchMetrics {
  totalCampaigns: number;
  sending: number;
  completed: number;
  scheduled: number;
  failed: number;
  cancelled: number;
  totalMessagesSent: number;
  totalMessagesDelivered: number;
  totalMessagesFailed: number;
  totalMessagesQueued: number;
  recentCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    sent: number;
    delivered: number;
    failed: number;
    totalContacts: number;
    startedAt: string | null;
  }>;
}

export const useCampaignDispatchMetrics = (dateRange: DateRange = '7d', customRange?: CustomDateRange) => {
  return useQuery({
    queryKey: ['campaign-dispatch-metrics', dateRange, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async (): Promise<CampaignDispatchMetrics> => {
      const { start, end } = getDateRange(dateRange, customRange);

      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name, status, sent, delivered, failed, total_contacts, started_at, completed_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      const campaignList = campaigns || [];
      
      const totalCampaigns = campaignList.length;
      const sending = campaignList.filter(c => c.status === 'sending').length;
      const completed = campaignList.filter(c => c.status === 'completed').length;
      const scheduled = campaignList.filter(c => c.status === 'scheduled').length;
      const failed = campaignList.filter(c => c.status === 'failed').length;
      const cancelled = campaignList.filter(c => c.status === 'cancelled').length;

      const totalMessagesSent = campaignList.reduce((sum, c) => sum + (c.sent || 0), 0);
      const totalMessagesDelivered = campaignList.reduce((sum, c) => sum + (c.delivered || 0), 0);
      const totalMessagesFailed = campaignList.reduce((sum, c) => sum + (c.failed || 0), 0);

      // Count queued messages for active campaigns
      const activeCampaignIds = campaignList
        .filter(c => c.status === 'sending' || c.status === 'scheduled')
        .map(c => c.id);

      let totalMessagesQueued = 0;
      if (activeCampaignIds.length > 0) {
        const { count } = await supabase
          .from('campaign_messages')
          .select('*', { count: 'exact', head: true })
          .in('campaign_id', activeCampaignIds)
          .eq('status', 'queued');
        totalMessagesQueued = count || 0;
      }

      const recentCampaigns = campaignList.slice(0, 10).map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        sent: c.sent || 0,
        delivered: c.delivered || 0,
        failed: c.failed || 0,
        totalContacts: c.total_contacts || 0,
        startedAt: c.started_at,
      }));

      return {
        totalCampaigns,
        sending,
        completed,
        scheduled,
        failed,
        cancelled,
        totalMessagesSent,
        totalMessagesDelivered,
        totalMessagesFailed,
        totalMessagesQueued,
        recentCampaigns,
      };
    },
  });
};

// ==================== FUNNEL METRICS ====================
export interface FunnelStageMetric {
  stageId: string;
  stageName: string;
  stageColor: string;
  dealCount: number;
  dealValue: number;
  probability: number;
  conversionRate: number;
}

export interface FunnelMetrics {
  stages: FunnelStageMetric[];
  dealsInNegotiation: number;
  valueInNegotiation: number;
  dealsClosed: number;
  valueClosed: number;
  dealsLost: number;
  valueLost: number;
  avgSalesCycle: number;
}

export const useFunnelMetrics = (dateRange: DateRange = '30d', funnelId?: string, customRange?: CustomDateRange) => {
  return useQuery({
    queryKey: ['funnel-metrics', dateRange, funnelId, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async (): Promise<FunnelMetrics> => {
      const { start, end } = getDateRange(dateRange, customRange);

      let stagesQuery = supabase
        .from('funnel_stages')
        .select('id, name, color, probability, is_final, final_type, display_order, funnel_id')
        .order('display_order', { ascending: true });
      
      if (funnelId) {
        stagesQuery = stagesQuery.eq('funnel_id', funnelId);
      }

      const { data: stages } = await stagesQuery;

      const stageIds = stages?.map(s => s.id) || [];
      const wonStageIds = stages?.filter(s => s.final_type === 'won').map(s => s.id) || [];
      const lostStageIds = stages?.filter(s => s.final_type === 'lost').map(s => s.id) || [];
      const finalStageIds = [...wonStageIds, ...lostStageIds];
      const openStageIds = stageIds.filter(id => !finalStageIds.includes(id));
      
      // Pipeline ATUAL (sem filtro de data) — mostra estado real do funil
      const { data: currentPipelineDeals } = await supabase
        .from('funnel_deals')
        .select('id, stage_id, value')
        .in('stage_id', openStageIds.length > 0 ? openStageIds : ['']);

      // Deals ganhos/perdidos NO PERÍODO (filtro por closed_at)
      const { data: closedDeals } = await supabase
        .from('funnel_deals')
        .select('id, stage_id, value, closed_at, created_at')
        .in('stage_id', finalStageIds.length > 0 ? finalStageIds : [''])
        .gte('closed_at', start.toISOString())
        .lte('closed_at', end.toISOString());

      // Stage metrics show CURRENT pipeline state
      const stageMetrics: FunnelStageMetric[] = (stages || [])
        .filter(s => !s.is_final)
        .map(stage => {
          const stageDeals = currentPipelineDeals?.filter(d => d.stage_id === stage.id) || [];
          const dealCount = stageDeals.length;
          const dealValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
          
          return {
            stageId: stage.id,
            stageName: stage.name,
            stageColor: stage.color || '#3B82F6',
            dealCount,
            dealValue,
            probability: stage.probability || 0,
            conversionRate: 0,
          };
        });

      for (let i = 0; i < stageMetrics.length; i++) {
        if (i === 0) {
          stageMetrics[i].conversionRate = 100;
        } else {
          const prevCount = stageMetrics[i - 1].dealCount;
          stageMetrics[i].conversionRate = prevCount > 0 
            ? (stageMetrics[i].dealCount / prevCount) * 100 
            : 0;
        }
      }

      const dealsInNegotiation = currentPipelineDeals?.length || 0;
      const valueInNegotiation = currentPipelineDeals
        ?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;

      const wonDeals = closedDeals?.filter(d => wonStageIds.includes(d.stage_id)) || [];
      const dealsClosed = wonDeals.length;
      const valueClosed = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);

      const lostDeals = closedDeals?.filter(d => lostStageIds.includes(d.stage_id)) || [];
      const dealsLost = lostDeals.length;
      const valueLost = lostDeals.reduce((sum, d) => sum + (d.value || 0), 0);

      let totalCycleDays = 0;
      let cycleCount = 0;
      wonDeals.forEach(deal => {
        if (deal.closed_at && deal.created_at) {
          const created = new Date(deal.created_at);
          const closed = new Date(deal.closed_at);
          const days = Math.floor((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          if (days >= 0) {
            totalCycleDays += days;
            cycleCount++;
          }
        }
      });
      const avgSalesCycle = cycleCount > 0 ? totalCycleDays / cycleCount : 0;

      return {
        stages: stageMetrics,
        dealsInNegotiation,
        valueInNegotiation,
        dealsClosed,
        valueClosed,
        dealsLost,
        valueLost,
        avgSalesCycle,
      };
    },
  });
};

// ==================== FUNNELS LIST ====================
export interface FunnelListItem {
  id: string;
  name: string;
}

export const useFunnelsList = () => {
  return useQuery({
    queryKey: ['funnels-list'],
    queryFn: async (): Promise<FunnelListItem[]> => {
      const { data } = await supabase
        .from('funnels')
        .select('id, name')
        .order('name', { ascending: true });
      
      return data || [];
    },
  });
};

// ==================== AUTOMATION METRICS ====================
export interface AutomationMetrics {
  activeFlows: number;
  flowsTriggeredToday: number;
  resolvedByBot: number;
  transferredToHuman: number;
  botSuccessRate: number;
  flowFailures: number;
}

export const useAutomationMetrics = (dateRange: DateRange = '7d', customRange?: CustomDateRange) => {
  return useQuery({
    queryKey: ['automation-metrics', dateRange, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async (): Promise<AutomationMetrics> => {
      const { start, end } = getDateRange(dateRange, customRange);
      const todayStart = startOfDay(new Date());

      const { count: activeFlows } = await supabase
        .from('chatbot_flows')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { count: flowsTriggeredToday } = await supabase
        .from('chatbot_executions')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', todayStart.toISOString());

      const { data: botConversations } = await supabase
        .from('conversations')
        .select('ai_handled, ai_handoff_requested, status')
        .eq('ai_handled', true)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const resolvedByBot = botConversations?.filter(c => c.status === 'archived' && !c.ai_handoff_requested).length || 0;
      const transferredToHuman = botConversations?.filter(c => c.ai_handoff_requested).length || 0;
      
      const totalBotHandled = botConversations?.length || 0;
      const botSuccessRate = totalBotHandled > 0 ? (resolvedByBot / totalBotHandled) * 100 : 0;

      const { count: flowFailures } = await supabase
        .from('chatbot_executions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'error')
        .gte('started_at', start.toISOString())
        .lte('started_at', end.toISOString());

      return {
        activeFlows: activeFlows || 0,
        flowsTriggeredToday: flowsTriggeredToday || 0,
        resolvedByBot,
        transferredToHuman,
        botSuccessRate,
        flowFailures: flowFailures || 0,
      };
    },
  });
};

// ==================== AGENT PERFORMANCE METRICS ====================
export interface AgentMetric {
  agentId: string;
  agentName: string;
  attendances: number;
  messagesSent: number;
  avgResponseTime: number;
  dealsWon: number;
  dealsValue: number;
}

export interface AgentPerformanceMetrics {
  agents: AgentMetric[];
  totalAttendances: number;
  avgResponseTime: number;
  abandonedConversations: number;
  resumedConversations: number;
}

export const useAgentPerformanceMetrics = (dateRange: DateRange = '7d', customRange?: CustomDateRange) => {
  return useQuery({
    queryKey: ['agent-performance-metrics', dateRange, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async (): Promise<AgentPerformanceMetrics> => {
      const { start, end } = getDateRange(dateRange, customRange);

      const { data: metricsData } = await supabase
        .from('user_performance_metrics')
        .select('user_id, messages_sent, conversations_handled, deals_won, deals_value, avg_response_time_seconds')
        .gte('metric_date', start.toISOString().split('T')[0])
        .lte('metric_date', end.toISOString().split('T')[0]);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name');

      const agentMap = new Map<string, AgentMetric & { _responseTimeSum: number; _responseTimeCount: number }>();
      
      metricsData?.forEach(m => {
        const existing = agentMap.get(m.user_id);
        const profile = profiles?.find(p => p.id === m.user_id);
        const responseTime = m.avg_response_time_seconds || 0;
        const convHandled = m.conversations_handled || 0;
        
        if (existing) {
          existing.attendances += convHandled;
          existing.messagesSent += m.messages_sent || 0;
          existing.dealsWon += m.deals_won || 0;
          existing.dealsValue += Number(m.deals_value) || 0;
          existing._responseTimeSum += responseTime * convHandled;
          existing._responseTimeCount += convHandled;
          existing.avgResponseTime = existing._responseTimeCount > 0
            ? existing._responseTimeSum / existing._responseTimeCount
            : 0;
        } else {
          agentMap.set(m.user_id, {
            agentId: m.user_id,
            agentName: profile?.full_name || 'Usuário',
            attendances: convHandled,
            messagesSent: m.messages_sent || 0,
            avgResponseTime: responseTime,
            dealsWon: m.deals_won || 0,
            dealsValue: Number(m.deals_value) || 0,
            _responseTimeSum: responseTime * convHandled,
            _responseTimeCount: convHandled,
          });
        }
      });

      const agents = Array.from(agentMap.values()).sort((a, b) => b.dealsValue - a.dealsValue);
      const totalAttendances = agents.reduce((sum, a) => sum + a.attendances, 0);
      
      // Fix: weighted average for global response time
      const totalResponseTimeSum = agents.reduce((sum, a) => sum + (a as any)._responseTimeSum, 0);
      const totalResponseTimeCount = agents.reduce((sum, a) => sum + (a as any)._responseTimeCount, 0);
      const avgResponseTime = totalResponseTimeCount > 0 ? totalResponseTimeSum / totalResponseTimeCount : 0;

      const { count: abandonedConversations } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'archived')
        .gte('updated_at', start.toISOString())
        .lte('updated_at', end.toISOString())
        .eq('last_message_direction', 'inbound');

      const { count: resumedConversations } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .lt('created_at', start.toISOString())
        .gte('last_message_at', start.toISOString())
        .lte('last_message_at', end.toISOString());

      return {
        agents,
        totalAttendances,
        avgResponseTime,
        abandonedConversations: abandonedConversations || 0,
        resumedConversations: resumedConversations || 0,
      };
    },
  });
};

// ==================== FINANCIAL METRICS ====================
export interface FinancialMetrics {
  salesTotal: number;
  valueInNegotiation: number;
  avgTicket: number;
  estimatedRevenue: number;
  salesByPeriod: Array<{ date: string; value: number }>;
}

export const useFinancialMetrics = (dateRange: DateRange = '30d', customRange?: CustomDateRange) => {
  return useQuery({
    queryKey: ['financial-metrics', dateRange, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async (): Promise<FinancialMetrics> => {
      const { start, end } = getDateRange(dateRange, customRange);

      const { data: stages } = await supabase
        .from('funnel_stages')
        .select('id, probability, final_type');

      const wonStageIds = stages?.filter(s => s.final_type === 'won').map(s => s.id) || [];

      const { data: deals } = await supabase
        .from('funnel_deals')
        .select('id, stage_id, value, closed_at, created_at');

      // Won deals in period
      const wonDeals = deals?.filter(d => 
        wonStageIds.includes(d.stage_id) && 
        d.closed_at && 
        new Date(d.closed_at) >= start &&
        new Date(d.closed_at) <= end
      ) || [];
      
      const salesTotal = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
      // Fix: filter deals with value > 0 for average ticket to avoid distortion
      const wonDealsWithValue = wonDeals.filter(d => (d.value || 0) > 0);
      const avgTicket = wonDealsWithValue.length > 0 ? wonDealsWithValue.reduce((sum, d) => sum + (d.value || 0), 0) / wonDealsWithValue.length : 0;

      // Value in negotiation (pipeline total - always current state)
      const lostStageIds = stages?.filter(s => s.final_type === 'lost').map(s => s.id) || [];
      const finalStageIds = [...wonStageIds, ...lostStageIds];
      const openDeals = deals?.filter(d => !finalStageIds.includes(d.stage_id)) || [];
      const valueInNegotiation = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);

      let estimatedRevenue = 0;
      openDeals.forEach(deal => {
        const stage = stages?.find(s => s.id === deal.stage_id);
        const probability = (stage?.probability || 0) / 100;
        estimatedRevenue += (deal.value || 0) * probability;
      });

      const salesByDate = new Map<string, number>();
      wonDeals.forEach(deal => {
        if (deal.closed_at) {
          const date = deal.closed_at.split('T')[0];
          salesByDate.set(date, (salesByDate.get(date) || 0) + (deal.value || 0));
        }
      });

      const salesByPeriod = Array.from(salesByDate.entries())
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        salesTotal,
        valueInNegotiation,
        avgTicket,
        estimatedRevenue,
        salesByPeriod,
      };
    },
  });
};

// ==================== USER PERFORMANCE DETAILED ====================
export interface UserPerformanceDetail {
  userId: string;
  userName: string;
  avgDailyWorkSeconds: number;
  totalWorkSeconds: number;
  charactersTyped: number;
  messagesSent: number;
  conversationsHandled: number;
  dealsOpen: number;
  dealsWon: number;
  dealsLost: number;
  winRate: number;
  avgTicket: number;
  totalRevenue: number;
  avgResponseTimeSeconds: number;
}

export interface UserPerformanceDetailedMetrics {
  users: UserPerformanceDetail[];
  totalCharactersTyped: number;
}

export const useUserPerformanceDetailed = (dateRange: DateRange = '7d', customRange?: CustomDateRange) => {
  return useQuery({
    queryKey: ['user-performance-detailed', dateRange, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async (): Promise<UserPerformanceDetailedMetrics> => {
      const { start, end } = getDateRange(dateRange, customRange);

      // Fetch everything in parallel — derive all user stats from real data tables
      // (user_activity_sessions / user_performance_metrics are not used because they
      //  require a background job to populate and are usually empty)
      const [profilesResult, outboundMsgsResult, stagesResult, openDealsResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name'),
        supabase
          .from('inbox_messages')
          .select('sent_by_user_id, content, conversation_id, created_at')
          .eq('direction', 'outbound')
          .not('sent_by_user_id', 'is', null)
          .not('is_ai_generated', 'is', true)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .limit(50000),
        supabase.from('funnel_stages').select('id, final_type').not('final_type', 'is', null),
        supabase
          .from('funnel_deals')
          .select('responsible_id')
          .not('responsible_id', 'is', null)
          .is('closed_at', null),
      ]);

      const profiles = profilesResult.data || [];
      const outboundMessages = outboundMsgsResult.data || [];
      const stages = stagesResult.data || [];
      const openDeals = openDealsResult.data || [];

      const wonStageIds = stages.filter(s => s.final_type === 'won').map(s => s.id);
      const lostStageIds = stages.filter(s => s.final_type === 'lost').map(s => s.id);
      const finalStageIds = [...wonStageIds, ...lostStageIds];

      const { data: closedDealsInPeriod } = await supabase
        .from('funnel_deals')
        .select('responsible_id, stage_id, value')
        .not('responsible_id', 'is', null)
        .in('stage_id', finalStageIds.length > 0 ? finalStageIds : [''])
        .gte('closed_at', start.toISOString())
        .lte('closed_at', end.toISOString());

      // Aggregate per-user stats from inbox_messages
      // dayMap tracks { date -> { min_ts, max_ts } } to compute daily activity span
      type UserMsgData = {
        chars: number;
        msgCount: number;
        convIds: Set<string>;
        dayMap: Map<string, { min: number; max: number }>;
      };
      const msgDataMap = new Map<string, UserMsgData>();

      outboundMessages.forEach(m => {
        if (!m.sent_by_user_id) return;
        const uid = m.sent_by_user_id;
        if (!msgDataMap.has(uid)) {
          msgDataMap.set(uid, { chars: 0, msgCount: 0, convIds: new Set(), dayMap: new Map() });
        }
        const data = msgDataMap.get(uid)!;
        data.chars += (m.content || '').length;
        data.msgCount++;
        if (m.conversation_id) data.convIds.add(m.conversation_id);

        // Track daily span: first to last message each day = approximate active time
        const ts = new Date(m.created_at).getTime();
        const day = m.created_at.slice(0, 10); // YYYY-MM-DD
        const dayData = data.dayMap.get(day);
        if (!dayData) {
          data.dayMap.set(day, { min: ts, max: ts });
        } else {
          if (ts < dayData.min) dayData.min = ts;
          if (ts > dayData.max) dayData.max = ts;
        }
      });

      // Open deals per responsible
      const openDealsMap = new Map<string, number>();
      openDeals.forEach(d => {
        if (d.responsible_id) openDealsMap.set(d.responsible_id, (openDealsMap.get(d.responsible_id) || 0) + 1);
      });

      // Closed deals in period: won vs lost per user
      const wonMap = new Map<string, { count: number; value: number }>();
      const lostMap = new Map<string, number>();
      (closedDealsInPeriod || []).forEach(d => {
        if (!d.responsible_id) return;
        if (wonStageIds.includes(d.stage_id)) {
          const e = wonMap.get(d.responsible_id);
          if (e) { e.count++; e.value += Number(d.value) || 0; }
          else wonMap.set(d.responsible_id, { count: 1, value: Number(d.value) || 0 });
        } else if (lostStageIds.includes(d.stage_id)) {
          lostMap.set(d.responsible_id, (lostMap.get(d.responsible_id) || 0) + 1);
        }
      });

      // Union of all known user IDs
      const allUserIds = new Set([
        ...msgDataMap.keys(),
        ...openDealsMap.keys(),
        ...wonMap.keys(),
        ...lostMap.keys(),
      ]);

      const userMap = new Map<string, UserPerformanceDetail>();
      for (const userId of allUserIds) {
        const profile = profiles.find(p => p.id === userId);
        const msgData = msgDataMap.get(userId);
        const won = wonMap.get(userId);
        const wonCount = won?.count || 0;
        const lostCount = lostMap.get(userId) || 0;
        const totalClosed = wonCount + lostCount;

        // Daily work time = sum of (last_msg_ts - first_msg_ts) per day
        let totalActiveSeconds = 0;
        msgData?.dayMap.forEach(({ min, max }) => {
          totalActiveSeconds += Math.max(0, Math.floor((max - min) / 1000));
        });
        const activeDays = msgData?.dayMap.size || 0;

        userMap.set(userId, {
          userId,
          userName: profile?.full_name || 'Usuário',
          totalWorkSeconds: totalActiveSeconds,
          avgDailyWorkSeconds: activeDays > 0 ? totalActiveSeconds / activeDays : 0,
          charactersTyped: msgData?.chars || 0,
          messagesSent: msgData?.msgCount || 0,
          conversationsHandled: msgData?.convIds.size || 0,
          avgResponseTimeSeconds: 0,
          dealsOpen: openDealsMap.get(userId) || 0,
          dealsWon: wonCount,
          dealsLost: lostCount,
          winRate: totalClosed > 0 ? (wonCount / totalClosed) * 100 : 0,
          totalRevenue: won?.value || 0,
          avgTicket: wonCount > 0 ? (won?.value || 0) / wonCount : 0,
        });
      }

      const users = Array.from(userMap.values())
        .sort((a, b) => b.messagesSent - a.messagesSent || b.charactersTyped - a.charactersTyped);
      const totalCharactersTyped = users.reduce((sum, u) => sum + u.charactersTyped, 0);

      return { users, totalCharactersTyped };
    },
  });
};

// ==================== CRM KPIS ====================
export interface CRMKPIs {
  dealsOpen: number;
  valueInPipeline: number;
  winRate: number;
  avgSalesCycleDays: number;
  avgTicket: number;
  revenueClosed: number;
  forecastRevenue: number;
  staleDeals: number;
}

export const useCRMKPIs = (dateRange: DateRange = '30d', funnelId?: string, customRange?: CustomDateRange) => {
  return useQuery({
    queryKey: ['crm-kpis', dateRange, funnelId, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async (): Promise<CRMKPIs> => {
      const { start, end } = getDateRange(dateRange, customRange);
      const sevenDaysAgo = subDays(new Date(), 7);

      let stagesQuery = supabase.from('funnel_stages').select('id, probability, final_type, funnel_id');
      if (funnelId) stagesQuery = stagesQuery.eq('funnel_id', funnelId);
      const { data: stages } = await stagesQuery;

      const stageIds = stages?.map(s => s.id) || [];
      const wonStageIds = stages?.filter(s => s.final_type === 'won').map(s => s.id) || [];
      const lostStageIds = stages?.filter(s => s.final_type === 'lost').map(s => s.id) || [];
      const finalStageIds = [...wonStageIds, ...lostStageIds];
      const openStageIds = stageIds.filter(id => !finalStageIds.includes(id));

      const [openDealsResult, closedDealsResult] = await Promise.all([
        supabase
          .from('funnel_deals')
          .select('id, stage_id, value, updated_at')
          .in('stage_id', openStageIds.length > 0 ? openStageIds : ['']),
        supabase
          .from('funnel_deals')
          .select('id, stage_id, value, closed_at, created_at')
          .in('stage_id', finalStageIds.length > 0 ? finalStageIds : [''])
          .gte('closed_at', start.toISOString())
          .lte('closed_at', end.toISOString()),
      ]);

      const openDealsList = openDealsResult.data || [];
      const closedDealsList = closedDealsResult.data || [];

      const wonDeals = closedDealsList.filter(d => wonStageIds.includes(d.stage_id));
      const lostDeals = closedDealsList.filter(d => lostStageIds.includes(d.stage_id));
      const totalClosed = wonDeals.length + lostDeals.length;

      const revenueClosed = wonDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
      const wonWithValue = wonDeals.filter(d => (d.value || 0) > 0);
      const avgTicket = wonWithValue.length > 0
        ? wonWithValue.reduce((sum, d) => sum + (Number(d.value) || 0), 0) / wonWithValue.length
        : 0;

      let totalCycleDays = 0;
      let cycleCount = 0;
      wonDeals.forEach(d => {
        if (d.closed_at && d.created_at) {
          const days = Math.floor((new Date(d.closed_at).getTime() - new Date(d.created_at).getTime()) / 86400000);
          if (days >= 0) { totalCycleDays += days; cycleCount++; }
        }
      });

      let forecastRevenue = 0;
      openDealsList.forEach(deal => {
        const stage = stages?.find(s => s.id === deal.stage_id);
        forecastRevenue += (Number(deal.value) || 0) * ((stage?.probability || 0) / 100);
      });

      const staleDeals = openDealsList.filter(d => new Date(d.updated_at) < sevenDaysAgo).length;

      return {
        dealsOpen: openDealsList.length,
        valueInPipeline: openDealsList.reduce((sum, d) => sum + (Number(d.value) || 0), 0),
        winRate: totalClosed > 0 ? (wonDeals.length / totalClosed) * 100 : 0,
        avgSalesCycleDays: cycleCount > 0 ? totalCycleDays / cycleCount : 0,
        avgTicket,
        revenueClosed,
        forecastRevenue,
        staleDeals,
      };
    },
  });
};

// ==================== ALERT METRICS ====================
export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  count?: number;
}

export interface AlertMetrics {
  alerts: Alert[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
}

export const useAlertMetrics = () => {
  return useQuery({
    queryKey: ['alert-metrics'],
    queryFn: async (): Promise<AlertMetrics> => {
      const alerts: Alert[] = [];
      const now = new Date();
      const thirtyMinutesAgo = subHours(now, 0.5);
      const twentyFourHoursAgo = subHours(now, 24);

      const { count: unansweredCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .gt('unread_count', 0)
        .lt('last_message_at', thirtyMinutesAgo.toISOString());

      if (unansweredCount && unansweredCount > 0) {
        alerts.push({
          id: 'unanswered-leads',
          type: 'critical',
          title: 'Leads sem resposta',
          description: `${unansweredCount} leads aguardando resposta há mais de 30 minutos`,
          count: unansweredCount,
        });
      }

      const { data: alertInstances } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_name, status');

      const { data: recentMessages } = await supabase
        .from('inbox_messages')
        .select('conversation_id, status')
        .gte('created_at', twentyFourHoursAgo.toISOString())
        .eq('direction', 'outbound');

      const recentConvIds = [...new Set(recentMessages?.map(m => m.conversation_id).filter(Boolean) || [])];
      const { data: recentConversations } = await supabase
        .from('conversations')
        .select('id, instance_id')
        .in('id', recentConvIds.length > 0 ? recentConvIds : ['']);

      alertInstances?.forEach(instance => {
        const instanceConvIds = recentConversations?.filter(c => c.instance_id === instance.id).map(c => c.id) || [];
        const instanceMessages = recentMessages?.filter(m => instanceConvIds.includes(m.conversation_id)) || [];
        const failedMessages = instanceMessages.filter(m => m.status === 'failed').length;
        const totalMessages = instanceMessages.length;
        
        if (totalMessages >= 10) {
          const failureRate = (failedMessages / totalMessages) * 100;
          if (failureRate >= 30) {
            alerts.push({
              id: `chip-failure-${instance.id}`,
              type: 'critical',
              title: 'Chip com alta taxa de falha',
              description: `${instance.instance_name}: ${failureRate.toFixed(1)}% de falha nas últimas 24h`,
              count: failedMessages,
            });
          }
        }

        if (instance.status === 'disconnected') {
          alerts.push({
            id: `chip-disconnected-${instance.id}`,
            type: 'warning',
            title: 'Chip desconectado',
            description: `${instance.instance_name} está desconectado`,
          });
        }
      });

      const { data: flows } = await supabase
        .from('chatbot_flows')
        .select('id, name, is_active, updated_at');

      const { data: recentExecutions } = await supabase
        .from('chatbot_executions')
        .select('flow_id, status')
        .gte('started_at', twentyFourHoursAgo.toISOString());

      flows?.forEach(flow => {
        if (flow.is_active) {
          const flowExecutions = recentExecutions?.filter(e => e.flow_id === flow.id) || [];
          const errorExecutions = flowExecutions.filter(e => e.status === 'error').length;
          
          if (flowExecutions.length > 0 && errorExecutions / flowExecutions.length >= 0.5) {
            alerts.push({
              id: `flow-errors-${flow.id}`,
              type: 'warning',
              title: 'Fluxo com muitos erros',
              description: `${flow.name}: ${errorExecutions} erros nas últimas 24h`,
              count: errorExecutions,
            });
          }
        }
      });

      const yesterday = subDays(now, 1);
      
      const { count: leadsToday } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfDay(now).toISOString());

      const { count: leadsYesterday } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfDay(yesterday).toISOString())
        .lt('created_at', startOfDay(now).toISOString());

      if (leadsYesterday && leadsYesterday > 10 && leadsToday !== null) {
        const dropRate = ((leadsYesterday - leadsToday) / leadsYesterday) * 100;
        if (dropRate >= 50) {
          alerts.push({
            id: 'lead-drop',
            type: 'warning',
            title: 'Queda repentina de leads',
            description: `${dropRate.toFixed(0)}% menos leads que ontem`,
          });
        }
      }

      const { count: messagesToday } = await supabase
        .from('inbox_messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfDay(now).toISOString());

      const { count: messagesYesterday } = await supabase
        .from('inbox_messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfDay(yesterday).toISOString())
        .lt('created_at', startOfDay(now).toISOString());

      if (messagesYesterday && messagesYesterday > 0 && messagesToday) {
        const increaseRate = ((messagesToday - messagesYesterday) / messagesYesterday) * 100;
        if (increaseRate >= 200) {
          alerts.push({
            id: 'message-peak',
            type: 'info',
            title: 'Pico anormal de mensagens',
            description: `${increaseRate.toFixed(0)}% mais mensagens que ontem`,
          });
        }
      }

      const criticalCount = alerts.filter(a => a.type === 'critical').length;
      const warningCount = alerts.filter(a => a.type === 'warning').length;
      const infoCount = alerts.filter(a => a.type === 'info').length;

      return {
        alerts: alerts.sort((a, b) => {
          const order = { critical: 0, warning: 1, info: 2 };
          return order[a.type] - order[b.type];
        }),
        criticalCount,
        warningCount,
        infoCount,
      };
    },
    refetchInterval: 60000,
  });
};
