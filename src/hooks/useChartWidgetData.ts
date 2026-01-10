import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  secondaryValue?: number;
}

export interface ChartData {
  data: ChartDataPoint[];
  loading: boolean;
  total?: number;
}

export const useChartWidgetData = (widgetKey: string, dateRange: DateRange): ChartData => {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setData([]);
          setLoading(false);
          return;
        }

        const startDate = dateRange.start.toISOString();
        const endDate = dateRange.end.toISOString();

        switch (widgetKey) {
          case 'grafico_leads_periodo': {
            // Get leads per day in the period
            const { data: contacts } = await supabase
              .from('contacts')
              .select('created_at')
              .eq('user_id', user.id)
              .gte('created_at', startDate)
              .lte('created_at', endDate);

            const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
            const chartData = days.map(day => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const count = contacts?.filter(c => 
                format(parseISO(c.created_at), 'yyyy-MM-dd') === dayStr
              ).length || 0;
              
              return {
                label: format(day, 'dd/MM', { locale: ptBR }),
                value: count
              };
            });
            
            setData(chartData);
            setTotal(contacts?.length || 0);
            break;
          }

          case 'grafico_deals_resultado': {
            // Get won vs lost deals
            const { data: deals } = await supabase
              .from('funnel_deals')
              .select(`
                id,
                close_reason_id,
                funnel_close_reasons!inner(type)
              `)
              .eq('user_id', user.id)
              .not('closed_at', 'is', null)
              .gte('closed_at', startDate)
              .lte('closed_at', endDate);

            const won = deals?.filter((d: any) => d.funnel_close_reasons?.type === 'won').length || 0;
            const lost = deals?.filter((d: any) => d.funnel_close_reasons?.type === 'lost').length || 0;
            
            setData([
              { label: 'Ganhos', value: won, color: 'hsl(var(--chart-2))' },
              { label: 'Perdidos', value: lost, color: 'hsl(var(--chart-1))' }
            ]);
            setTotal(won + lost);
            break;
          }

          case 'grafico_deals_etapa': {
            // Get deals per funnel stage
            const { data: deals } = await supabase
              .from('funnel_deals')
              .select(`
                stage_id,
                funnel_stages!inner(name)
              `)
              .eq('user_id', user.id)
              .is('closed_at', null);

            const stageCount: Record<string, number> = {};
            deals?.forEach((d: any) => {
              const stageName = d.funnel_stages?.name || 'Sem etapa';
              stageCount[stageName] = (stageCount[stageName] || 0) + 1;
            });

            const chartData = Object.entries(stageCount).map(([label, value]) => ({
              label,
              value
            }));
            
            setData(chartData);
            setTotal(deals?.length || 0);
            break;
          }

          case 'grafico_mensagens_periodo': {
            // Get messages sent and received per day
            const { data: messages } = await supabase
              .from('inbox_messages')
              .select('created_at, direction')
              .eq('user_id', user.id)
              .gte('created_at', startDate)
              .lte('created_at', endDate);

            const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
            const chartData = days.map(day => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayMessages = messages?.filter(m => 
                format(parseISO(m.created_at), 'yyyy-MM-dd') === dayStr
              ) || [];
              
              return {
                label: format(day, 'dd/MM', { locale: ptBR }),
                value: dayMessages.filter(m => m.direction === 'out').length,
                secondaryValue: dayMessages.filter(m => m.direction === 'in').length
              };
            });
            
            setData(chartData);
            setTotal(messages?.length || 0);
            break;
          }

          case 'grafico_conversas_status': {
            // Get conversation status distribution
            const { data: conversations } = await supabase
              .from('conversations')
              .select('status')
              .eq('user_id', user.id);

            const statusCount: Record<string, number> = {};
            conversations?.forEach(c => {
              const status = c.status || 'unknown';
              statusCount[status] = (statusCount[status] || 0) + 1;
            });

            const statusLabels: Record<string, string> = {
              'open': 'Abertas',
              'closed': 'Fechadas',
              'pending': 'Pendentes',
              'resolved': 'Resolvidas',
              'unknown': 'Outros'
            };

            const colors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
            const chartData = Object.entries(statusCount).map(([status, value], i) => ({
              label: statusLabels[status] || status,
              value,
              color: colors[i % colors.length]
            }));
            
            setData(chartData);
            setTotal(conversations?.length || 0);
            break;
          }

          case 'grafico_automacao_periodo': {
            // Get chatbot executions per day
            const { data: executions } = await supabase
              .from('chatbot_executions')
              .select('created_at, status')
              .eq('user_id', user.id)
              .gte('created_at', startDate)
              .lte('created_at', endDate);

            const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
            const chartData = days.map(day => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const count = executions?.filter(e => 
                e.created_at && format(parseISO(e.created_at), 'yyyy-MM-dd') === dayStr
              ).length || 0;
              
              return {
                label: format(day, 'dd/MM', { locale: ptBR }),
                value: count
              };
            });
            
            setData(chartData);
            setTotal(executions?.length || 0);
            break;
          }

          case 'grafico_tarefas_status': {
            // Get task status distribution
            const { data: tasks } = await supabase
              .from('conversation_tasks')
              .select('completed_at, due_date')
              .eq('user_id', user.id);

            const now = new Date();
            const pending = tasks?.filter(t => !t.completed_at && (!t.due_date || new Date(t.due_date) >= now)).length || 0;
            const completed = tasks?.filter(t => t.completed_at).length || 0;
            const overdue = tasks?.filter(t => !t.completed_at && t.due_date && new Date(t.due_date) < now).length || 0;
            
            setData([
              { label: 'Pendentes', value: pending, color: 'hsl(var(--chart-3))' },
              { label: 'Concluídas', value: completed, color: 'hsl(var(--chart-2))' },
              { label: 'Atrasadas', value: overdue, color: 'hsl(var(--chart-1))' }
            ]);
            setTotal(tasks?.length || 0);
            break;
          }

          case 'grafico_produtividade': {
            // Get work hours per day
            const { data: sessions } = await supabase
              .from('user_activity_sessions')
              .select('started_at, duration_seconds, session_type')
              .eq('user_id', user.id)
              .eq('session_type', 'work')
              .gte('started_at', startDate)
              .lte('started_at', endDate);

            const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
            const chartData = days.map(day => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const daySeconds = sessions?.filter(s => 
                s.started_at && format(parseISO(s.started_at), 'yyyy-MM-dd') === dayStr
              ).reduce((acc, s) => acc + (s.duration_seconds || 0), 0) || 0;
              
              return {
                label: format(day, 'EEE', { locale: ptBR }),
                value: Math.round(daySeconds / 3600 * 10) / 10 // Hours with 1 decimal
              };
            });
            
            setData(chartData);
            setTotal(sessions?.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) || 0);
            break;
          }

          default:
            setData([]);
            setTotal(0);
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [widgetKey, dateRange.start.getTime(), dateRange.end.getTime()]);

  return { data, loading, total };
};
