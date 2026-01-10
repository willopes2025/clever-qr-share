import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfDay, startOfWeek, startOfMonth, subDays, differenceInMinutes } from "date-fns";

interface WidgetData {
  value: string | number;
  trend?: number;
  trendLabel?: string;
  subValue?: string;
}

export const useWidgetData = (widgetKey: string) => {
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
      const today = new Date();
      const startOfToday = startOfDay(today);
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const monthStart = startOfMonth(today);

      try {
        let result: WidgetData = { value: '-' };

        switch (widgetKey) {
          case 'conversas_ativas': {
            const { count } = await supabase
              .from('conversations')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('status', 'active');
            result = { value: count || 0, subValue: 'em atendimento' };
            break;
          }

          case 'conversas_resolvidas': {
            const { count } = await supabase
              .from('conversations')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('status', 'closed')
              .gte('updated_at', startOfToday.toISOString());
            result = { value: count || 0, subValue: 'finalizadas hoje' };
            break;
          }

          case 'conversas_sem_resposta': {
            const { count } = await supabase
              .from('conversations')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .is('first_response_at', null)
              .eq('status', 'active');
            result = { value: count || 0, subValue: 'aguardando resposta' };
            break;
          }

          case 'deals_criados': {
            const { count } = await supabase
              .from('funnel_deals')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('created_at', format(subDays(today, 7), 'yyyy-MM-dd'));
            result = { value: count || 0, subValue: 'últimos 7 dias' };
            break;
          }

          case 'deals_ganhos': {
            const { count } = await supabase
              .from('funnel_deals')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('status', 'ganho');
            result = { value: count || 0, subValue: 'vendas fechadas' };
            break;
          }

          case 'valor_pipeline': {
            const { data: deals } = await supabase
              .from('funnel_deals')
              .select('value')
              .eq('user_id', user.id)
              .eq('status', 'open');
            const total = deals?.reduce((acc, d) => acc + (d.value || 0), 0) || 0;
            result = { 
              value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total),
              subValue: 'em negociação'
            };
            break;
          }

          case 'leads_hoje': {
            const { count } = await supabase
              .from('contacts')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('created_at', startOfToday.toISOString());
            result = { value: count || 0, subValue: 'novos leads' };
            break;
          }

          case 'leads_semana': {
            const { count } = await supabase
              .from('contacts')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('created_at', weekStart.toISOString());
            result = { value: count || 0, subValue: 'esta semana' };
            break;
          }

          case 'chips_ativos': {
            const { count } = await supabase
              .from('whatsapp_instances')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('status', 'connected');
            result = { value: count || 0, subValue: 'conectados' };
            break;
          }

          case 'fluxos_ativos': {
            const { count } = await supabase
              .from('chatbot_flows')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('is_active', true);
            result = { value: count || 0, subValue: 'ativos' };
            break;
          }

          case 'tarefas_pendentes': {
            const { count } = await supabase
              .from('conversation_tasks')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .is('completed_at', null);
            result = { value: count || 0, subValue: 'pendentes' };
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
  }, [widgetKey, user?.id]);

  return { data, loading };
};
