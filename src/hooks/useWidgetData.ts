import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { startOfDay, endOfDay, format, differenceInSeconds } from "date-fns";

export interface DateRange {
  start: Date;
  end: Date;
}

interface WidgetData {
  value: string | number;
  trend?: number;
  trendLabel?: string;
  subValue?: string;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const useWidgetData = (widgetKey: string, dateRange: DateRange) => {
  const { user } = useAuth();
  const [data, setData] = useState<WidgetData>({ value: '-' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const startDate = startOfDay(dateRange.start);
      const endDate = endOfDay(dateRange.end);
      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();

      try {
        let result: WidgetData = { value: '-' };

        switch (widgetKey) {
          // ============ CONVERSAS ============
          case 'conversas_ativas': {
            const { count } = await supabase
              .from('conversations')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('status', 'active');
            result = { value: count || 0, subValue: 'em atendimento (atual)' };
            break;
          }

          case 'conversas_resolvidas': {
            const { count } = await supabase
              .from('conversations')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('status', 'closed')
              .gte('updated_at', startISO)
              .lte('updated_at', endISO);
            result = { value: count || 0, subValue: 'finalizadas no período' };
            break;
          }

          case 'conversas_sem_resposta': {
            const { count } = await supabase
              .from('conversations')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .is('first_response_at', null)
              .eq('status', 'active')
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            result = { value: count || 0, subValue: 'aguardando resposta' };
            break;
          }

          // ============ MENSAGENS ============
          case 'mensagens_enviadas': {
            const { count } = await supabase
              .from('inbox_messages')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('direction', 'outgoing')
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            result = { value: count || 0, subValue: 'mensagens enviadas' };
            break;
          }

          case 'mensagens_recebidas': {
            const { count } = await supabase
              .from('inbox_messages')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('direction', 'incoming')
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            result = { value: count || 0, subValue: 'mensagens recebidas' };
            break;
          }

          case 'tempo_medio_resposta': {
            // Buscar conversas com first_response_at no período
            const { data: convs } = await supabase
              .from('conversations')
              .select('created_at, first_response_at')
              .eq('user_id', user.id)
              .not('first_response_at', 'is', null)
              .gte('created_at', startISO)
              .lte('created_at', endISO);

            if (convs && convs.length > 0) {
              const totalSeconds = convs.reduce((acc, c) => {
                const created = new Date(c.created_at);
                const responded = new Date(c.first_response_at!);
                return acc + differenceInSeconds(responded, created);
              }, 0);
              const avgSeconds = totalSeconds / convs.length;
              result = { value: formatTime(avgSeconds), subValue: 'tempo médio' };
            } else {
              result = { value: '-', subValue: 'sem dados' };
            }
            break;
          }

          // ============ DEALS/VENDAS ============
          case 'deals_criados': {
            const { count } = await supabase
              .from('funnel_deals')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            result = { value: count || 0, subValue: 'novos deals' };
            break;
          }

          case 'deals_ganhos': {
            // Get close reasons that are "won" type
            const { data: wonReasons } = await supabase
              .from('funnel_close_reasons')
              .select('id')
              .eq('user_id', user.id)
              .eq('type', 'won');
            
            const wonIds = wonReasons?.map(r => r.id) || [];
            
            if (wonIds.length > 0) {
              const { count } = await supabase
                .from('funnel_deals')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .in('close_reason_id', wonIds)
                .gte('closed_at', startISO)
                .lte('closed_at', endISO);
              result = { value: count || 0, subValue: 'vendas fechadas' };
            } else {
              result = { value: 0, subValue: 'vendas fechadas' };
            }
            break;
          }

          case 'deals_perdidos': {
            // Get close reasons that are "lost" type
            const { data: lostReasons } = await supabase
              .from('funnel_close_reasons')
              .select('id')
              .eq('user_id', user.id)
              .eq('type', 'lost');
            
            const lostIds = lostReasons?.map(r => r.id) || [];
            
            if (lostIds.length > 0) {
              const { count } = await supabase
                .from('funnel_deals')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .in('close_reason_id', lostIds)
                .gte('closed_at', startISO)
                .lte('closed_at', endISO);
              result = { value: count || 0, subValue: 'deals perdidos' };
            } else {
              result = { value: 0, subValue: 'deals perdidos' };
            }
            break;
          }

          case 'valor_pipeline': {
            // Pipeline value - open deals (not date filtered, current snapshot)
            const { data: deals } = await supabase
              .from('funnel_deals')
              .select('value')
              .eq('user_id', user.id)
              .is('closed_at', null);
            const total = deals?.reduce((acc, d) => acc + (d.value || 0), 0) || 0;
            result = { value: formatCurrency(total), subValue: 'em negociação (atual)' };
            break;
          }

          case 'valor_ganho': {
            // Get close reasons that are "won" type
            const { data: wonReasons } = await supabase
              .from('funnel_close_reasons')
              .select('id')
              .eq('user_id', user.id)
              .eq('type', 'won');
            
            const wonIds = wonReasons?.map(r => r.id) || [];
            
            if (wonIds.length > 0) {
              const { data: deals } = await supabase
                .from('funnel_deals')
                .select('value')
                .eq('user_id', user.id)
                .in('close_reason_id', wonIds)
                .gte('closed_at', startISO)
                .lte('closed_at', endISO);
              const total = deals?.reduce((acc, d) => acc + (d.value || 0), 0) || 0;
              result = { value: formatCurrency(total), subValue: 'valor ganho no período' };
            } else {
              result = { value: formatCurrency(0), subValue: 'valor ganho no período' };
            }
            break;
          }

          case 'taxa_conversao': {
            // Deals created in period
            const { count: total } = await supabase
              .from('funnel_deals')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('created_at', startISO)
              .lte('created_at', endISO);

            // Won deals in period
            const { data: wonReasons } = await supabase
              .from('funnel_close_reasons')
              .select('id')
              .eq('user_id', user.id)
              .eq('type', 'won');
            
            const wonIds = wonReasons?.map(r => r.id) || [];
            let wonCount = 0;
            
            if (wonIds.length > 0) {
              const { count } = await supabase
                .from('funnel_deals')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .in('close_reason_id', wonIds)
                .gte('closed_at', startISO)
                .lte('closed_at', endISO);
              wonCount = count || 0;
            }

            const rate = (total || 0) > 0 ? (wonCount / (total || 1)) * 100 : 0;
            result = { value: `${rate.toFixed(1)}%`, subValue: 'taxa de conversão' };
            break;
          }

          case 'ticket_medio': {
            // Get close reasons that are "won" type
            const { data: wonReasons } = await supabase
              .from('funnel_close_reasons')
              .select('id')
              .eq('user_id', user.id)
              .eq('type', 'won');
            
            const wonIds = wonReasons?.map(r => r.id) || [];
            
            if (wonIds.length > 0) {
              const { data: deals } = await supabase
                .from('funnel_deals')
                .select('value')
                .eq('user_id', user.id)
                .in('close_reason_id', wonIds)
                .gte('closed_at', startISO)
                .lte('closed_at', endISO);
              const total = deals?.reduce((acc, d) => acc + (d.value || 0), 0) || 0;
              const avg = deals && deals.length > 0 ? total / deals.length : 0;
              result = { value: formatCurrency(avg), subValue: 'ticket médio' };
            } else {
              result = { value: formatCurrency(0), subValue: 'ticket médio' };
            }
            break;
          }

          // ============ LEADS ============
          case 'leads_hoje':
          case 'leads_semana':
          case 'leads_mes':
          case 'leads_periodo': {
            const { count } = await supabase
              .from('contacts')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            result = { value: count || 0, subValue: 'novos leads' };
            break;
          }

          // ============ WHATSAPP ============
          case 'chips_ativos': {
            const { count } = await supabase
              .from('whatsapp_instances')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('status', 'connected');
            result = { value: count || 0, subValue: 'conectados (atual)' };
            break;
          }

          case 'chips_inativos': {
            const { count } = await supabase
              .from('whatsapp_instances')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .neq('status', 'connected');
            result = { value: count || 0, subValue: 'desconectados (atual)' };
            break;
          }

          case 'mensagens_whatsapp': {
            const { count } = await supabase
              .from('inbox_messages')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            result = { value: count || 0, subValue: 'total de mensagens' };
            break;
          }

          case 'taxa_entrega': {
            const { data: messages } = await supabase
              .from('inbox_messages')
              .select('status, delivered_at')
              .eq('user_id', user.id)
              .eq('direction', 'outgoing')
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            
            const total = messages?.length || 0;
            const delivered = messages?.filter(m => m.delivered_at !== null).length || 0;
            const rate = total > 0 ? (delivered / total) * 100 : 0;
            result = { value: `${rate.toFixed(1)}%`, subValue: 'taxa de entrega' };
            break;
          }

          case 'taxa_falha': {
            const { data: messages } = await supabase
              .from('inbox_messages')
              .select('status')
              .eq('user_id', user.id)
              .eq('direction', 'outgoing')
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            
            const total = messages?.length || 0;
            const failed = messages?.filter(m => m.status === 'failed').length || 0;
            const rate = total > 0 ? (failed / total) * 100 : 0;
            result = { value: `${rate.toFixed(1)}%`, subValue: 'taxa de falha' };
            break;
          }

          // ============ AUTOMAÇÃO ============
          case 'fluxos_ativos': {
            const { count } = await supabase
              .from('chatbot_flows')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('is_active', true);
            result = { value: count || 0, subValue: 'fluxos ativos (atual)' };
            break;
          }

          case 'execucoes_hoje':
          case 'execucoes_periodo': {
            const { count } = await supabase
              .from('chatbot_executions')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            result = { value: count || 0, subValue: 'execuções no período' };
            break;
          }

          case 'resolvidos_bot': {
            const { count } = await supabase
              .from('chatbot_executions')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('status', 'completed')
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            result = { value: count || 0, subValue: 'resolvidos pelo bot' };
            break;
          }

          case 'erros_fluxo': {
            const { count } = await supabase
              .from('chatbot_executions')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('status', 'failed')
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            result = { value: count || 0, subValue: 'erros de fluxo' };
            break;
          }

          case 'taxa_sucesso_bot': {
            const { data: executions } = await supabase
              .from('chatbot_executions')
              .select('status')
              .eq('user_id', user.id)
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            
            const total = executions?.length || 0;
            const completed = executions?.filter(e => e.status === 'completed').length || 0;
            const rate = total > 0 ? (completed / total) * 100 : 0;
            result = { value: `${rate.toFixed(1)}%`, subValue: 'taxa de sucesso' };
            break;
          }

          // ============ TAREFAS ============
          case 'tarefas_pendentes': {
            const { count } = await supabase
              .from('conversation_tasks')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .is('completed_at', null);
            result = { value: count || 0, subValue: 'pendentes (total)' };
            break;
          }

          case 'tarefas_concluidas': {
            const { count } = await supabase
              .from('conversation_tasks')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .not('completed_at', 'is', null)
              .gte('completed_at', startISO)
              .lte('completed_at', endISO);
            result = { value: count || 0, subValue: 'concluídas no período' };
            break;
          }

          case 'tarefas_atrasadas': {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const { count } = await supabase
              .from('conversation_tasks')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .is('completed_at', null)
              .lt('due_date', todayStr);
            result = { value: count || 0, subValue: 'atrasadas (atual)' };
            break;
          }

          // ============ PERFORMANCE HOME OFFICE ============
          case 'tempo_trabalhado_hoje':
          case 'tempo_trabalhado': {
            const { data: sessions } = await supabase
              .from('user_activity_sessions')
              .select('duration_seconds, session_type')
              .eq('user_id', user.id)
              .eq('session_type', 'work')
              .gte('started_at', startISO)
              .lte('started_at', endISO);
            
            const totalSeconds = sessions?.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) || 0;
            result = { value: formatTime(totalSeconds), subValue: 'tempo trabalhado' };
            break;
          }

          case 'tempo_em_pausa': {
            const { data: sessions } = await supabase
              .from('user_activity_sessions')
              .select('duration_seconds, session_type')
              .eq('user_id', user.id)
              .in('session_type', ['break', 'lunch'])
              .gte('started_at', startISO)
              .lte('started_at', endISO);
            
            const totalSeconds = sessions?.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) || 0;
            result = { value: formatTime(totalSeconds), subValue: 'tempo em pausa' };
            break;
          }

          case 'primeira_atividade': {
            const { data: sessions } = await supabase
              .from('user_activity_sessions')
              .select('started_at')
              .eq('user_id', user.id)
              .gte('started_at', startISO)
              .lte('started_at', endISO)
              .order('started_at', { ascending: true })
              .limit(1);
            
            if (sessions && sessions.length > 0) {
              const time = new Date(sessions[0].started_at);
              result = { value: format(time, 'HH:mm'), subValue: 'primeira atividade no período' };
            } else {
              result = { value: '-', subValue: 'sem atividade no período' };
            }
            break;
          }

          case 'ultima_atividade': {
            const { data: sessions } = await supabase
              .from('user_activity_sessions')
              .select('last_activity')
              .eq('user_id', user.id)
              .gte('started_at', startISO)
              .lte('started_at', endISO)
              .not('last_activity', 'is', null)
              .order('last_activity', { ascending: false })
              .limit(1);
            
            if (sessions && sessions.length > 0 && sessions[0].last_activity) {
              const time = new Date(sessions[0].last_activity);
              result = { value: format(time, 'HH:mm'), subValue: 'última atividade no período' };
            } else {
              result = { value: '-', subValue: 'sem atividade no período' };
            }
            break;
          }

          case 'taxa_produtividade': {
            const { data: sessions } = await supabase
              .from('user_activity_sessions')
              .select('duration_seconds, session_type')
              .eq('user_id', user.id)
              .gte('started_at', startISO)
              .lte('started_at', endISO);
            
            const workSeconds = sessions?.filter(s => s.session_type === 'work')
              .reduce((acc, s) => acc + (s.duration_seconds || 0), 0) || 0;
            const breakSeconds = sessions?.filter(s => s.session_type === 'break' || s.session_type === 'lunch')
              .reduce((acc, s) => acc + (s.duration_seconds || 0), 0) || 0;
            
            const total = workSeconds + breakSeconds;
            const rate = total > 0 ? (workSeconds / total) * 100 : 0;
            result = { value: `${rate.toFixed(1)}%`, subValue: 'produtividade' };
            break;
          }

          case 'horas_semana': {
            const { data: sessions } = await supabase
              .from('user_activity_sessions')
              .select('duration_seconds')
              .eq('user_id', user.id)
              .eq('session_type', 'work')
              .gte('started_at', startISO)
              .lte('started_at', endISO);
            
            const totalSeconds = sessions?.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) || 0;
            const hours = (totalSeconds / 3600).toFixed(1);
            result = { value: `${hours}h`, subValue: 'horas no período' };
            break;
          }

          // ============ ATENDIMENTO - Implementados ============
          case 'taxa_resposta': {
            const { data: convs } = await supabase
              .from('conversations')
              .select('first_response_at')
              .eq('user_id', user.id)
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            
            const total = convs?.length || 0;
            const responded = convs?.filter(c => c.first_response_at !== null).length || 0;
            const rate = total > 0 ? (responded / total) * 100 : 0;
            result = { value: `${rate.toFixed(1)}%`, subValue: `${responded} de ${total} respondidas` };
            break;
          }

          case 'fila_atendimento': {
            const { count } = await supabase
              .from('conversations')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .in('status', ['pending', 'queued', 'waiting', 'open']);
            result = { value: count || 0, subValue: 'aguardando (atual)' };
            break;
          }

          case 'transferidos_humano': {
            const { count } = await supabase
              .from('conversations')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('ai_handoff_requested', true)
              .gte('updated_at', startISO)
              .lte('updated_at', endISO);
            result = { value: count || 0, subValue: 'transferidos para humano' };
            break;
          }

          // ============ TAREFAS - Implementados ============
          case 'proximas_tarefas': {
            const today = format(new Date(), 'yyyy-MM-dd');
            const nextWeek = format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
            const { count } = await supabase
              .from('conversation_tasks')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .is('completed_at', null)
              .gte('due_date', today)
              .lte('due_date', nextWeek);
            result = { value: count || 0, subValue: 'próximos 7 dias (fixo)' };
            break;
          }

          case 'taxa_conclusao': {
            const { data: tasks } = await supabase
              .from('conversation_tasks')
              .select('completed_at')
              .eq('user_id', user.id)
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            
            const total = tasks?.length || 0;
            const completed = tasks?.filter(t => t.completed_at !== null).length || 0;
            const rate = total > 0 ? (completed / total) * 100 : 0;
            result = { value: `${rate.toFixed(1)}%`, subValue: `${completed} de ${total}` };
            break;
          }

          // ============ PERFORMANCE - Implementados ============
          case 'meta_horas_diarias': {
            const todayStartISO = startOfDay(new Date()).toISOString();
            const todayEndISO = endOfDay(new Date()).toISOString();
            
            const { data: sessions } = await supabase
              .from('user_activity_sessions')
              .select('duration_seconds')
              .eq('user_id', user.id)
              .eq('session_type', 'work')
              .gte('started_at', todayStartISO)
              .lte('started_at', todayEndISO);
            
            const totalSeconds = sessions?.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) || 0;
            const totalHours = totalSeconds / 3600;
            const progress = Math.min((totalHours / 8) * 100, 100);
            result = { 
              value: `${progress.toFixed(0)}%`, 
              subValue: `${totalHours.toFixed(1)}h de 8h` 
            };
            break;
          }

          case 'streak_dias': {
            // Buscar sessões dos últimos 30 dias
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const { data: sessions } = await supabase
              .from('user_activity_sessions')
              .select('started_at')
              .eq('user_id', user.id)
              .eq('session_type', 'work')
              .gte('started_at', thirtyDaysAgo.toISOString())
              .order('started_at', { ascending: false });
            
            // Agrupar por dia
            const daysWithActivity = new Set<string>();
            sessions?.forEach(s => {
              daysWithActivity.add(format(new Date(s.started_at), 'yyyy-MM-dd'));
            });
            
            // Calcular streak
            let streak = 0;
            const today = new Date();
            for (let i = 0; i < 30; i++) {
              const checkDate = new Date(today);
              checkDate.setDate(checkDate.getDate() - i);
              const dateStr = format(checkDate, 'yyyy-MM-dd');
              if (daysWithActivity.has(dateStr)) {
                streak++;
              } else if (i > 0) {
                break;
              }
            }
            
            result = { value: streak, subValue: 'dias consecutivos' };
            break;
          }

          // ============ LEADS - Implementados ============
          case 'leads_por_origem': {
            const { data: contacts } = await supabase
              .from('contacts')
              .select('id')
              .eq('user_id', user.id)
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            
            result = { value: contacts?.length || 0, subValue: 'leads no período' };
            break;
          }

          case 'taxa_qualificacao': {
            const { data: allContacts } = await supabase
              .from('contacts')
              .select('status')
              .eq('user_id', user.id)
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            
            const total = allContacts?.length || 0;
            const qualified = allContacts?.filter(c => c.status === 'qualified').length || 0;
            const rate = total > 0 ? (qualified / total) * 100 : 0;
            result = { value: `${rate.toFixed(1)}%`, subValue: `${qualified} qualificados` };
            break;
          }

          // ============ WHATSAPP - Implementados ============
          case 'status_chips': {
            const { data: instances } = await supabase
              .from('whatsapp_instances')
              .select('status')
              .eq('user_id', user.id);
            
            const connected = instances?.filter(i => i.status === 'connected').length || 0;
            const total = instances?.length || 0;
            result = { value: `${connected}/${total}`, subValue: 'conectados' };
            break;
          }

          // ============ DEALS - Implementados ============
          case 'deals_sem_acao': {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { count } = await supabase
              .from('funnel_deals')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .is('closed_at', null)
              .lt('updated_at', sevenDaysAgo);
            result = { value: count || 0, subValue: 'sem ação há 7+ dias' };
            break;
          }

          // ============ ALERTAS - Implementados ============
          case 'alertas_criticos': {
            // Contar tarefas muito atrasadas (mais de 3 dias)
            const threeDaysAgo = format(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
            const { count } = await supabase
              .from('conversation_tasks')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .is('completed_at', null)
              .lt('due_date', threeDaysAgo);
            result = { value: count || 0, subValue: 'tarefas críticas' };
            break;
          }

          case 'alertas_aviso': {
            // Conversas sem resposta há mais de 24h
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { count } = await supabase
              .from('conversations')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('status', 'active')
              .is('first_response_at', null)
              .lt('created_at', oneDayAgo);
            result = { value: count || 0, subValue: 'avisos' };
            break;
          }

          // ============ REQUEREM INTEGRAÇÃO/CONFIGURAÇÃO ============
          case 'sla_cumprido':
          case 'sla_quebrado':
          case 'sla_por_membro': {
            result = { value: '-', subValue: 'Configure SLA' };
            break;
          }

          case 'saldo_disponivel':
          case 'recebido_periodo':
          case 'a_receber':
          case 'inadimplencia':
          case 'mrr_atual':
          case 'previsao_30dias': {
            result = { value: '-', subValue: 'Requer integração financeira' };
            break;
          }

          case 'membros_online': {
            // Buscar organização do usuário
            const { data: memberData } = await supabase
              .from('team_members')
              .select('organization_id')
              .eq('user_id', user.id)
              .eq('status', 'active')
              .maybeSingle();

            if (!memberData?.organization_id) {
              result = { value: '-', subValue: 'Sem equipe' };
              break;
            }

            // Contar membros ativos na organização
            const { count: membersCount } = await supabase
              .from('team_members')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', memberData.organization_id)
              .eq('status', 'active');
              
            result = { value: membersCount || 0, subValue: 'membros ativos' };
            break;
          }

          case 'performance_equipe': {
            // Buscar organização do usuário
            const { data: memberDataPerf } = await supabase
              .from('team_members')
              .select('organization_id')
              .eq('user_id', user.id)
              .eq('status', 'active')
              .maybeSingle();

            if (!memberDataPerf?.organization_id) {
              result = { value: '-', subValue: 'Sem equipe' };
              break;
            }

            // Buscar user_ids dos membros da organização
            const { data: orgMembers } = await supabase
              .from('team_members')
              .select('user_id')
              .eq('organization_id', memberDataPerf.organization_id)
              .eq('status', 'active')
              .not('user_id', 'is', null);

            const memberUserIds = orgMembers?.map(m => m.user_id).filter(Boolean) as string[] || [];

            if (memberUserIds.length === 0) {
              result = { value: '-', subValue: 'Sem membros' };
              break;
            }

            // Buscar métricas de performance no período
            const { data: metrics } = await supabase
              .from('user_performance_metrics')
              .select('total_work_seconds')
              .in('user_id', memberUserIds)
              .gte('metric_date', format(dateRange.start, 'yyyy-MM-dd'))
              .lte('metric_date', format(dateRange.end, 'yyyy-MM-dd'));

            const totalSeconds = metrics?.reduce((acc, m) => acc + (m.total_work_seconds || 0), 0) || 0;
            result = { value: formatTime(totalSeconds), subValue: 'horas trabalhadas' };
            break;
          }

          case 'ranking_membros': {
            // Buscar organização do usuário
            const { data: memberDataRank } = await supabase
              .from('team_members')
              .select('organization_id')
              .eq('user_id', user.id)
              .eq('status', 'active')
              .maybeSingle();

            if (!memberDataRank?.organization_id) {
              result = { value: '-', subValue: 'Sem equipe' };
              break;
            }

            // Buscar membros com seus nomes
            const { data: orgMembersRank } = await supabase
              .from('team_members')
              .select('user_id, profiles:user_id(full_name)')
              .eq('organization_id', memberDataRank.organization_id)
              .eq('status', 'active')
              .not('user_id', 'is', null);

            const memberUserIdsRank = orgMembersRank?.map(m => m.user_id).filter(Boolean) as string[] || [];

            if (memberUserIdsRank.length === 0) {
              result = { value: '-', subValue: 'Sem membros' };
              break;
            }

            // Buscar métricas de performance no período
            const { data: metricsRank } = await supabase
              .from('user_performance_metrics')
              .select('user_id, deals_won')
              .in('user_id', memberUserIdsRank)
              .gte('metric_date', format(dateRange.start, 'yyyy-MM-dd'))
              .lte('metric_date', format(dateRange.end, 'yyyy-MM-dd'));

            // Agregar por user_id
            const userDeals: Record<string, number> = {};
            metricsRank?.forEach(m => {
              userDeals[m.user_id] = (userDeals[m.user_id] || 0) + (m.deals_won || 0);
            });

            // Encontrar o top performer
            let topUserId = '';
            let maxDeals = 0;
            Object.entries(userDeals).forEach(([userId, deals]) => {
              if (deals > maxDeals) {
                maxDeals = deals;
                topUserId = userId;
              }
            });

            if (topUserId) {
              const topMember = orgMembersRank?.find(m => m.user_id === topUserId);
              const name = (topMember?.profiles as any)?.full_name || 'Membro';
              result = { value: name, subValue: `${maxDeals} vendas` };
            } else {
              result = { value: '-', subValue: 'Sem vendas no período' };
            }
            break;
          }

          case 'carga_trabalho': {
            // Buscar organização do usuário
            const { data: memberDataCarga } = await supabase
              .from('team_members')
              .select('organization_id')
              .eq('user_id', user.id)
              .eq('status', 'active')
              .maybeSingle();

            if (!memberDataCarga?.organization_id) {
              result = { value: '-', subValue: 'Sem equipe' };
              break;
            }

            // Buscar user_ids dos membros da organização
            const { data: orgMembersCarga } = await supabase
              .from('team_members')
              .select('user_id')
              .eq('organization_id', memberDataCarga.organization_id)
              .eq('status', 'active')
              .not('user_id', 'is', null);

            const memberUserIdsCarga = orgMembersCarga?.map(m => m.user_id).filter(Boolean) as string[] || [];

            if (memberUserIdsCarga.length === 0) {
              result = { value: '-', subValue: 'Sem membros' };
              break;
            }

            // Contar conversas ativas atribuídas aos membros
            const { count: activeCounts } = await supabase
              .from('conversations')
              .select('*', { count: 'exact', head: true })
              .in('assigned_to', memberUserIdsCarga)
              .eq('status', 'active');

            const avgLoad = memberUserIdsCarga.length > 0 
              ? Math.round((activeCounts || 0) / memberUserIdsCarga.length) 
              : 0;
            
            result = { value: avgLoad, subValue: 'conversas/membro' };
            break;
          }

          // ============ GRÁFICOS (handled by ChartWidget) ============
          case 'funil_visual':
          case 'ranking_vendedores':
          case 'painel_alertas':
          case 'leads_duplicados':
          case 'leads_reativados': {
            result = { value: '-', subValue: 'Visualizar gráfico' };
            break;
          }

          default:
            result = { value: '-', subValue: 'Dados disponíveis em breve' };
        }

        setData(result);
      } catch (error) {
        console.error(`Error fetching data for ${widgetKey}:`, error);
        setData({ value: '-', subValue: 'Erro ao carregar' });
      }

      setLoading(false);
    };

    fetchData();
  }, [widgetKey, user?.id, dateRange.start.getTime(), dateRange.end.getTime()]);

  return { data, loading };
};
