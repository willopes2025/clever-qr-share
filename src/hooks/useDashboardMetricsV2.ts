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

      const { data, error } = await supabase.rpc('get_overview_metrics', {
        p_start: start.toISOString(),
        p_end: end.toISOString(),
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      const auto = Number(row?.auto_attendances || 0);
      const human = Number(row?.human_attendances || 0);
      const responded = Number(row?.responded_conversations || 0);
      const total = auto + human;
      const responseRate = total > 0 ? Math.min(100, (responded / total) * 100) : 0;

      return {
        leadsToday: Number(row?.leads_today || 0),
        activeConversations: Number(row?.active_conversations || 0),
        autoAttendances: auto,
        humanAttendances: human,
        unansweredLeads: Number(row?.unanswered_leads || 0),
        avgFirstResponseTime: Number(row?.avg_first_response_seconds || 0),
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
  messagesByInstance: Array<{ instanceId: string; instanceName: string; sent: number; received: number; delivered: number; sentVsReceivedRate: number }>;
  activeChips: number;
  inactiveChips: number;
}

type WhatsAppInstanceStatsRow = {
  instance_id: string;
  instance_name: string;
  sent: number;
  delivered: number;
  failed: number;
  received: number;
};

type SupabaseWithWhatsAppInstanceStats = {
  rpc(
    fn: 'get_whatsapp_message_stats_by_instance',
    args: { p_start: string; p_end: string }
  ): Promise<{ data: WhatsAppInstanceStatsRow[] | null; error: Error | null }>;
};

export const useWhatsAppMetrics = (dateRange: DateRange = '7d', customRange?: CustomDateRange) => {
  return useQuery({
    queryKey: ['whatsapp-metrics', dateRange, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async (): Promise<WhatsAppMetrics> => {
      const { start, end } = getDateRange(dateRange, customRange);

      const { data: byInstanceData, error: byInstanceError } = await (supabase as unknown as SupabaseWithWhatsAppInstanceStats).rpc('get_whatsapp_message_stats_by_instance', {
        p_start: start.toISOString(),
        p_end: end.toISOString(),
      });

      if (byInstanceError) {
        console.error('[useWhatsAppMetrics] by instance error:', byInstanceError);
      }

      const instancesResult = await supabase.from('whatsapp_instances').select('id, instance_name, status');

      const instances = instancesResult.data || [];

      const messagesByInstance = (byInstanceData || [])
        .map(row => {
          const sent = Number(row.sent || 0);
          const received = Number(row.received || 0);
          const delivered = Number(row.delivered || 0);
          const rate = received > 0 ? (sent / received) * 100 : (sent > 0 ? 100 : 0);
          return {
            instanceId: row.instance_id,
            instanceName: row.instance_name || 'Desconhecido',
            sent,
            received,
            delivered,
            sentVsReceivedRate: rate,
          };
        })
        .sort((a, b) => (b.sent + b.received) - (a.sent + a.received));

      const messagesSent = messagesByInstance.reduce((sum, row) => sum + row.sent, 0);
      const messagesDelivered = messagesByInstance.reduce((sum, row) => sum + row.delivered, 0);
      const messagesFailed = ((byInstanceData || []) as Array<{ failed: number }>).reduce((sum, row) => sum + Number(row.failed || 0), 0);
      const deliveryRate = messagesSent > 0 ? (messagesDelivered / messagesSent) * 100 : 0;

      // Active/inactive chips: Evolution instances + Meta numbers count as active chips
      const activeEvolution = instances.filter(i => i.status === 'connected').length;
      const inactiveEvolution = instances.filter(i => i.status !== 'connected').length;
      // Meta numbers are always "active" if they exist and have messages
      const activeMetaCount = new Set(messagesByInstance.map(row => row.instanceId).filter(key => key.startsWith('meta:'))).size;

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

      // Buscar campanhas que:
      //  - foram criadas OU iniciadas no range; OU
      //  - estão com status ativo (sending/scheduled), independente da data,
      //    pra não esconder campanhas em andamento de períodos antigos.
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name, status, total_contacts, started_at, completed_at, created_at')
        .or(
          `and(created_at.gte.${start.toISOString()},created_at.lte.${end.toISOString()}),` +
          `and(started_at.gte.${start.toISOString()},started_at.lte.${end.toISOString()}),` +
          `status.in.(sending,scheduled)`
        )
        .order('created_at', { ascending: false });

      const campaignList = campaigns || [];

      const totalCampaigns = campaignList.length;
      const sending = campaignList.filter(c => c.status === 'sending').length;
      const completed = campaignList.filter(c => c.status === 'completed').length;
      const scheduled = campaignList.filter(c => c.status === 'scheduled').length;
      const failed = campaignList.filter(c => c.status === 'failed').length;
      const cancelled = campaignList.filter(c => c.status === 'cancelled').length;

      // Agregar contadores reais de campaign_messages (fonte de verdade),
      // em vez dos campos cacheados em campaigns que ficam dessincronizados.
      const messageCountsByCampaign = new Map<
        string,
        { sent: number; delivered: number; failed: number; queued: number }
      >();
      let totalMessagesSent = 0;
      let totalMessagesDelivered = 0;
      let totalMessagesFailed = 0;
      let totalMessagesQueued = 0;

      if (campaignList.length > 0) {
        const campaignIds = campaignList.map(c => c.id);
        // Paginação para evitar limite de 1000 linhas
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data: msgs, error } = await supabase
            .from('campaign_messages')
            .select('campaign_id, status')
            .in('campaign_id', campaignIds)
            .range(from, from + pageSize - 1);
          if (error || !msgs || msgs.length === 0) break;
          for (const m of msgs) {
            const bucket = messageCountsByCampaign.get(m.campaign_id) || {
              sent: 0,
              delivered: 0,
              failed: 0,
              queued: 0,
            };
            switch (m.status) {
              case 'sent':
                bucket.sent += 1;
                totalMessagesSent += 1;
                break;
              case 'delivered':
              case 'read':
                bucket.delivered += 1;
                bucket.sent += 1; // entregue conta como enviada
                totalMessagesDelivered += 1;
                totalMessagesSent += 1;
                break;
              case 'failed':
                bucket.failed += 1;
                totalMessagesFailed += 1;
                break;
              case 'queued':
              case 'pending':
                bucket.queued += 1;
                totalMessagesQueued += 1;
                break;
            }
            messageCountsByCampaign.set(m.campaign_id, bucket);
          }
          if (msgs.length < pageSize) break;
          from += pageSize;
        }
      }

      const recentCampaigns = campaignList.slice(0, 10).map(c => {
        const counts = messageCountsByCampaign.get(c.id) || {
          sent: 0,
          delivered: 0,
          failed: 0,
          queued: 0,
        };
        const totalMessages =
          counts.sent + counts.delivered + counts.failed + counts.queued;
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          sent: counts.sent,
          delivered: counts.delivered,
          failed: counts.failed,
          // Mostra o maior valor entre o cadastrado e o real em mensagens,
          // pra refletir filas que estouraram o total_contacts cacheado.
          totalContacts: Math.max(c.total_contacts || 0, totalMessages),
          startedAt: c.started_at,
        };
      });

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

type AgentMetricWithResponseAccumulator = AgentMetric & {
  _responseTimeSum: number;
  _responseTimeCount: number;
};

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

      const agentMap = new Map<string, AgentMetricWithResponseAccumulator>();
      
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
      const totalResponseTimeSum = agents.reduce((sum, a) => sum + a._responseTimeSum, 0);
      const totalResponseTimeCount = agents.reduce((sum, a) => sum + a._responseTimeCount, 0);
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

      // Buscar instâncias para excluir notification-only do alerta de "leads sem resposta"
      const { data: alertInstances } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_name, status, is_notification_only');

      const notificationInstanceIds = (alertInstances || [])
        .filter(i => i.is_notification_only)
        .map(i => i.id);

      let unansweredQuery = supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .gt('unread_count', 0)
        .eq('last_message_direction', 'inbound')
        .lt('last_message_at', thirtyMinutesAgo.toISOString());

      if (notificationInstanceIds.length > 0) {
        unansweredQuery = unansweredQuery.not('instance_id', 'in', `(${notificationInstanceIds.join(',')})`);
      }

      const { count: unansweredCount } = await unansweredQuery;

      if (unansweredCount && unansweredCount > 0) {
        alerts.push({
          id: 'unanswered-leads',
          type: 'critical',
          title: 'Leads sem resposta',
          description: `${unansweredCount} leads aguardando resposta há mais de 30 minutos`,
          count: unansweredCount,
        });
      }

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
        if (instance.is_notification_only) return; // ignora instâncias internas de notificação

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
