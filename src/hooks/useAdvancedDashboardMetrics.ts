import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { startOfDay, subDays, format, differenceInSeconds } from 'date-fns';

export type DateRange = '7d' | '30d' | '90d' | 'today';

export interface SalesMetrics {
  pipelineTotal: number;
  pipelineCount: number;
  dealsWon: number;
  dealsWonValue: number;
  dealsLost: number;
  dealsLostValue: number;
  conversionRate: number;
  avgDealValue: number;
  avgCycleTime: number; // in days
}

export interface MessagingMetrics {
  totalSent: number;
  totalReceived: number;
  dailyData: { date: string; sent: number; received: number }[];
}

export interface ResponseTimeMetrics {
  avgResponseTime: number; // in seconds
  dailyData: { date: string; avgTime: number }[];
}

export interface TeamProductivityMetrics {
  totalWorkSeconds: number;
  totalBreakSeconds: number;
  totalLunchSeconds: number;
  memberData: {
    userId: string;
    userName: string;
    workSeconds: number;
    breakSeconds: number;
    lunchSeconds: number;
    messagesSent: number;
    dealsWon: number;
    dealsValue: number;
    tasksCompleted: number;
  }[];
}

export interface ConversationMetrics {
  totalOpen: number;
  totalResolved: number;
  totalPending: number;
  aiHandled: number;
  handoffRequested: number;
}

export interface FunnelStageData {
  stageId: string;
  stageName: string;
  color: string;
  dealsCount: number;
  dealsValue: number;
  probability: number;
  order: number;
}

export interface DealStatusData {
  won: number;
  lost: number;
  open: number;
  wonValue: number;
  lostValue: number;
  openValue: number;
}

export interface Insight {
  id: string;
  type: 'warning' | 'success' | 'info';
  title: string;
  description: string;
}

function getDateRange(range: DateRange): { start: Date; end: Date } {
  const end = new Date();
  let start: Date;
  
  switch (range) {
    case 'today':
      start = startOfDay(new Date());
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
}

export function useSalesMetrics(dateRange: DateRange = '7d') {
  const { user } = useAuth();
  const { start, end } = getDateRange(dateRange);

  return useQuery({
    queryKey: ['salesMetrics', user?.id, dateRange],
    queryFn: async (): Promise<SalesMetrics> => {
      if (!user?.id) throw new Error('User not authenticated');

      // Get all deals for the user
      const { data: deals, error } = await supabase
        .from('funnel_deals')
        .select(`
          id,
          value,
          created_at,
          closed_at,
          stage_id,
          funnel_stages!inner (
            is_final,
            final_type
          )
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) throw error;

      // Get pipeline (open deals)
      const { data: pipelineDeals } = await supabase
        .from('funnel_deals')
        .select('value')
        .is('closed_at', null);

      const pipelineTotal = pipelineDeals?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;
      const pipelineCount = pipelineDeals?.length || 0;

      // Calculate won/lost from deals with final stages
      const wonDeals = deals?.filter((d: any) => 
        d.funnel_stages?.is_final && d.funnel_stages?.final_type === 'won'
      ) || [];
      const lostDeals = deals?.filter((d: any) => 
        d.funnel_stages?.is_final && d.funnel_stages?.final_type === 'lost'
      ) || [];

      const dealsWon = wonDeals.length;
      const dealsWonValue = wonDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
      const dealsLost = lostDeals.length;
      const dealsLostValue = lostDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);

      const totalClosed = dealsWon + dealsLost;
      const conversionRate = totalClosed > 0 ? (dealsWon / totalClosed) * 100 : 0;
      const avgDealValue = dealsWon > 0 ? dealsWonValue / dealsWon : 0;

      // Calculate average cycle time for won deals
      const cycleTimes = wonDeals
        .filter((d: any) => d.closed_at && d.created_at)
        .map((d: any) => {
          const created = new Date(d.created_at);
          const closed = new Date(d.closed_at);
          return differenceInSeconds(closed, created) / 86400; // Convert to days
        });
      const avgCycleTime = cycleTimes.length > 0 
        ? cycleTimes.reduce((a: number, b: number) => a + b, 0) / cycleTimes.length 
        : 0;

      return {
        pipelineTotal,
        pipelineCount,
        dealsWon,
        dealsWonValue,
        dealsLost,
        dealsLostValue,
        conversionRate,
        avgDealValue,
        avgCycleTime,
      };
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });
}

export function useMessagingMetrics(dateRange: DateRange = '7d') {
  const { user } = useAuth();
  const { start, end } = getDateRange(dateRange);

  return useQuery({
    queryKey: ['messagingMetrics', user?.id, dateRange],
    queryFn: async (): Promise<MessagingMetrics> => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data: messages, error } = await supabase
        .from('inbox_messages')
        .select('direction, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) throw error;

      const totalSent = messages?.filter(m => m.direction === 'outbound').length || 0;
      const totalReceived = messages?.filter(m => m.direction === 'inbound').length || 0;

      // Group by date
      const dailyMap = new Map<string, { sent: number; received: number }>();
      
      messages?.forEach(msg => {
        const dateKey = format(new Date(msg.created_at), 'yyyy-MM-dd');
        const current = dailyMap.get(dateKey) || { sent: 0, received: 0 };
        if (msg.direction === 'outbound') {
          current.sent++;
        } else {
          current.received++;
        }
        dailyMap.set(dateKey, current);
      });

      const dailyData = Array.from(dailyMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return { totalSent, totalReceived, dailyData };
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });
}

export function useResponseTimeMetrics(dateRange: DateRange = '7d') {
  const { user } = useAuth();
  const { start, end } = getDateRange(dateRange);

  return useQuery({
    queryKey: ['responseTimeMetrics', user?.id, dateRange],
    queryFn: async (): Promise<ResponseTimeMetrics> => {
      if (!user?.id) throw new Error('User not authenticated');

      // Get messages ordered by conversation and time
      const { data: messages, error } = await supabase
        .from('inbox_messages')
        .select('conversation_id, direction, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('conversation_id')
        .order('created_at');

      if (error) throw error;

      // Calculate response times (time between incoming and next outgoing)
      const responseTimes: { date: string; time: number }[] = [];
      let lastIncoming: { convId: string; time: Date } | null = null;

      messages?.forEach(msg => {
        if (msg.direction === 'inbound') {
          lastIncoming = { convId: msg.conversation_id, time: new Date(msg.created_at) };
        } else if (msg.direction === 'outbound' && lastIncoming && lastIncoming.convId === msg.conversation_id) {
          const responseTime = differenceInSeconds(new Date(msg.created_at), lastIncoming.time);
          if (responseTime > 0 && responseTime < 86400) { // Less than 24h
            responseTimes.push({
              date: format(new Date(msg.created_at), 'yyyy-MM-dd'),
              time: responseTime,
            });
          }
          lastIncoming = null;
        }
      });

      // Calculate daily averages
      const dailyMap = new Map<string, number[]>();
      responseTimes.forEach(rt => {
        const times = dailyMap.get(rt.date) || [];
        times.push(rt.time);
        dailyMap.set(rt.date, times);
      });

      const dailyData = Array.from(dailyMap.entries())
        .map(([date, times]) => ({
          date,
          avgTime: times.reduce((a, b) => a + b, 0) / times.length,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, rt) => sum + rt.time, 0) / responseTimes.length
        : 0;

      return { avgResponseTime, dailyData };
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });
}

export function useTeamProductivityMetrics(dateRange: DateRange = '7d') {
  const { user } = useAuth();
  const { start, end } = getDateRange(dateRange);

  return useQuery({
    queryKey: ['teamProductivityMetrics', user?.id, dateRange],
    queryFn: async (): Promise<TeamProductivityMetrics> => {
      if (!user?.id) throw new Error('User not authenticated');

      // Get performance metrics
      const { data: metrics, error: metricsError } = await supabase
        .from('user_performance_metrics')
        .select('*')
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'));

      if (metricsError) throw metricsError;

      // Get profiles for user names
      const userIds = [...new Set(metrics?.map(m => m.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      // Aggregate by user
      const userMap = new Map<string, {
        workSeconds: number;
        breakSeconds: number;
        lunchSeconds: number;
        messagesSent: number;
        dealsWon: number;
        dealsValue: number;
        tasksCompleted: number;
      }>();

      metrics?.forEach(m => {
        const current = userMap.get(m.user_id) || {
          workSeconds: 0,
          breakSeconds: 0,
          lunchSeconds: 0,
          messagesSent: 0,
          dealsWon: 0,
          dealsValue: 0,
          tasksCompleted: 0,
        };
        current.workSeconds += m.total_work_seconds || 0;
        current.breakSeconds += m.total_break_seconds || 0;
        current.lunchSeconds += m.total_lunch_seconds || 0;
        current.messagesSent += m.messages_sent || 0;
        current.dealsWon += m.deals_won || 0;
        current.dealsValue += m.deals_value || 0;
        current.tasksCompleted += m.tasks_completed || 0;
        userMap.set(m.user_id, current);
      });

      const memberData = Array.from(userMap.entries()).map(([userId, data]) => ({
        userId,
        userName: profileMap.get(userId) || 'Usuário',
        ...data,
      }));

      const totals = memberData.reduce(
        (acc, m) => ({
          workSeconds: acc.workSeconds + m.workSeconds,
          breakSeconds: acc.breakSeconds + m.breakSeconds,
          lunchSeconds: acc.lunchSeconds + m.lunchSeconds,
        }),
        { workSeconds: 0, breakSeconds: 0, lunchSeconds: 0 }
      );

      return {
        totalWorkSeconds: totals.workSeconds,
        totalBreakSeconds: totals.breakSeconds,
        totalLunchSeconds: totals.lunchSeconds,
        memberData: memberData.sort((a, b) => b.workSeconds - a.workSeconds),
      };
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });
}

export function useConversationMetrics(dateRange: DateRange = '7d') {
  const { user } = useAuth();
  const { start } = getDateRange(dateRange);

  return useQuery({
    queryKey: ['conversationMetrics', user?.id, dateRange],
    queryFn: async (): Promise<ConversationMetrics> => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('status, ai_handled, ai_handoff_requested, unread_count')
        .gte('created_at', start.toISOString());

      if (error) throw error;

      const totalOpen = conversations?.filter(c => c.status === 'open' || c.status === 'active').length || 0;
      const totalResolved = conversations?.filter(c => c.status === 'archived').length || 0;
      const totalPending = conversations?.filter(c => c.status === 'open' && (c as any).unread_count > 0).length || 0;
      const aiHandled = conversations?.filter(c => c.ai_handled).length || 0;
      const handoffRequested = conversations?.filter(c => c.ai_handoff_requested).length || 0;

      return { totalOpen, totalResolved, totalPending, aiHandled, handoffRequested };
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });
}

export function useFunnelStageMetrics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['funnelStageMetrics', user?.id],
    queryFn: async (): Promise<FunnelStageData[]> => {
      if (!user?.id) throw new Error('User not authenticated');

      // Get stages with deal counts
      const { data: stages, error: stagesError } = await supabase
        .from('funnel_stages')
        .select(`
          id,
          name,
          color,
          probability,
          display_order,
          is_final,
          funnel_deals (
            id,
            value,
            closed_at
          )
        `)
        .eq('is_final', false)
        .order('display_order');

      if (stagesError) throw stagesError;

      return (stages || []).map((stage: any) => {
        const openDeals = stage.funnel_deals?.filter((d: any) => !d.closed_at) || [];
        return {
          stageId: stage.id,
          stageName: stage.name,
          color: stage.color || '#6366f1',
          dealsCount: openDeals.length,
          dealsValue: openDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0),
          probability: stage.probability || 0,
          order: stage.display_order || 0,
        };
      }).sort((a, b) => a.order - b.order);
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });
}

export function useDealStatusMetrics(dateRange: DateRange = '7d') {
  const { user } = useAuth();
  const { start } = getDateRange(dateRange);

  return useQuery({
    queryKey: ['dealStatusMetrics', user?.id, dateRange],
    queryFn: async (): Promise<DealStatusData> => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data: deals, error } = await supabase
        .from('funnel_deals')
        .select(`
          value,
          closed_at,
          funnel_stages!inner (
            is_final,
            final_type
          )
        `)
        .gte('created_at', start.toISOString());

      if (error) throw error;

      const won = deals?.filter((d: any) => d.funnel_stages?.is_final && d.funnel_stages?.final_type === 'won') || [];
      const lost = deals?.filter((d: any) => d.funnel_stages?.is_final && d.funnel_stages?.final_type === 'lost') || [];
      const open = deals?.filter((d: any) => !d.funnel_stages?.is_final) || [];

      return {
        won: won.length,
        lost: lost.length,
        open: open.length,
        wonValue: won.reduce((sum: number, d: any) => sum + (d.value || 0), 0),
        lostValue: lost.reduce((sum: number, d: any) => sum + (d.value || 0), 0),
        openValue: open.reduce((sum: number, d: any) => sum + (d.value || 0), 0),
      };
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });
}

export function useInsights(dateRange: DateRange = '7d') {
  const { data: salesData } = useSalesMetrics(dateRange);
  const { data: responseData } = useResponseTimeMetrics(dateRange);
  const { data: conversationData } = useConversationMetrics(dateRange);

  const insights: Insight[] = [];

  // Response time insights
  if (responseData) {
    const avgMinutes = responseData.avgResponseTime / 60;
    if (avgMinutes > 30) {
      insights.push({
        id: 'slow-response',
        type: 'warning',
        title: 'Tempo de resposta alto',
        description: `Média de ${Math.round(avgMinutes)} minutos. Considere reduzir para menos de 15 min.`,
      });
    } else if (avgMinutes < 5) {
      insights.push({
        id: 'fast-response',
        type: 'success',
        title: 'Excelente tempo de resposta',
        description: `Média de ${Math.round(avgMinutes)} minutos. Continue assim!`,
      });
    }
  }

  // Sales insights
  if (salesData) {
    if (salesData.conversionRate > 50) {
      insights.push({
        id: 'high-conversion',
        type: 'success',
        title: 'Alta taxa de conversão',
        description: `${salesData.conversionRate.toFixed(1)}% de deals fechados com sucesso.`,
      });
    } else if (salesData.conversionRate < 20 && salesData.dealsWon + salesData.dealsLost > 5) {
      insights.push({
        id: 'low-conversion',
        type: 'warning',
        title: 'Taxa de conversão baixa',
        description: `Apenas ${salesData.conversionRate.toFixed(1)}% dos deals foram ganhos.`,
      });
    }

    if (salesData.pipelineCount > 0) {
      insights.push({
        id: 'pipeline-info',
        type: 'info',
        title: 'Pipeline ativo',
        description: `${salesData.pipelineCount} deals em aberto totalizando ${formatCurrency(salesData.pipelineTotal)}.`,
      });
    }
  }

  // Conversation insights
  if (conversationData) {
    if (conversationData.totalOpen > 10) {
      insights.push({
        id: 'open-conversations',
        type: 'warning',
        title: 'Muitas conversas abertas',
        description: `${conversationData.totalOpen} conversas aguardando resposta.`,
      });
    }

    if (conversationData.handoffRequested > 0) {
      insights.push({
        id: 'ai-handoffs',
        type: 'info',
        title: 'Handoffs de IA',
        description: `${conversationData.handoffRequested} conversas solicitaram atendimento humano.`,
      });
    }
  }

  return insights;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
