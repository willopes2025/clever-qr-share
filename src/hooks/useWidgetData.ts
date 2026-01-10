import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { startOfDay, startOfWeek } from "date-fns";

interface WidgetData {
  value: string | number;
  trend?: number;
  trendLabel?: string;
  subValue?: string;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

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

      try {
        let result: WidgetData = { value: '-' };

        switch (widgetKey) {
          // CONVERSAS
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

          // DEALS - Simplificado
          case 'deals_criados': {
            const { count } = await supabase
              .from('funnel_deals')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id);
            result = { value: count || 0, subValue: 'total de deals' };
            break;
          }

          case 'deals_ganhos':
          case 'deals_perdidos': {
            const { count: closedCount } = await supabase
              .from('funnel_deals')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .not('closed_at', 'is', null);
            result = { 
              value: closedCount || 0, 
              subValue: widgetKey === 'deals_ganhos' ? 'deals fechados' : 'deals encerrados' 
            };
            break;
          }

          case 'valor_pipeline': {
            const { data: deals } = await supabase
              .from('funnel_deals')
              .select('value')
              .eq('user_id', user.id)
              .is('closed_at', null);
            const total = deals?.reduce((acc, d) => acc + (d.value || 0), 0) || 0;
            result = { value: formatCurrency(total), subValue: 'em negociação' };
            break;
          }

          case 'valor_ganho': {
            const { data: deals } = await supabase
              .from('funnel_deals')
              .select('value')
              .eq('user_id', user.id)
              .not('closed_at', 'is', null);
            const total = deals?.reduce((acc, d) => acc + (d.value || 0), 0) || 0;
            result = { value: formatCurrency(total), subValue: 'valor fechado' };
            break;
          }

          case 'taxa_conversao': {
            const { count: total } = await supabase
              .from('funnel_deals')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id);
            const { count: closed } = await supabase
              .from('funnel_deals')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .not('closed_at', 'is', null);
            const rate = (total || 0) > 0 ? ((closed || 0) / (total || 1)) * 100 : 0;
            result = { value: `${rate.toFixed(1)}%`, subValue: 'taxa de fechamento' };
            break;
          }

          case 'ticket_medio': {
            const { data: deals } = await supabase
              .from('funnel_deals')
              .select('value')
              .eq('user_id', user.id)
              .not('closed_at', 'is', null);
            const total = deals?.reduce((acc, d) => acc + (d.value || 0), 0) || 0;
            const avg = deals && deals.length > 0 ? total / deals.length : 0;
            result = { value: formatCurrency(avg), subValue: 'ticket médio' };
            break;
          }

          // LEADS
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

          case 'leads_mes': {
            const { count } = await supabase
              .from('contacts')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id);
            result = { value: count || 0, subValue: 'total de leads' };
            break;
          }

          // WHATSAPP
          case 'chips_ativos': {
            const { count } = await supabase
              .from('whatsapp_instances')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('status', 'connected');
            result = { value: count || 0, subValue: 'conectados' };
            break;
          }

          case 'chips_inativos': {
            const { count } = await supabase
              .from('whatsapp_instances')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .neq('status', 'connected');
            result = { value: count || 0, subValue: 'desconectados' };
            break;
          }

          // AUTOMAÇÃO
          case 'fluxos_ativos': {
            const { count } = await supabase
              .from('chatbot_flows')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('is_active', true);
            result = { value: count || 0, subValue: 'ativos' };
            break;
          }

          case 'execucoes_hoje': {
            const { count } = await supabase
              .from('chatbot_executions')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('created_at', startOfToday.toISOString());
            result = { value: count || 0, subValue: 'execuções hoje' };
            break;
          }

          // TAREFAS
          case 'tarefas_pendentes': {
            const { count } = await supabase
              .from('conversation_tasks')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .is('completed_at', null);
            result = { value: count || 0, subValue: 'pendentes' };
            break;
          }

          case 'tarefas_concluidas': {
            const { count } = await supabase
              .from('conversation_tasks')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .not('completed_at', 'is', null);
            result = { value: count || 0, subValue: 'concluídas' };
            break;
          }

          case 'tarefas_atrasadas': {
            const todayStr = startOfToday.toISOString().split('T')[0];
            const { count } = await supabase
              .from('conversation_tasks')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .is('completed_at', null)
              .lt('due_date', todayStr);
            result = { value: count || 0, subValue: 'atrasadas' };
            break;
          }

          // PERFORMANCE (Placeholder)
          case 'mensagens_enviadas':
          case 'mensagens_recebidas':
          case 'tempo_trabalhado_hoje':
          case 'tempo_em_pausa':
          case 'primeira_atividade':
          case 'ultima_atividade':
          case 'taxa_produtividade':
          case 'meta_horas_diarias':
          case 'streak_dias':
          case 'horas_semana':
          case 'tempo_medio_resposta':
          case 'taxa_resposta':
          case 'sla_cumprido':
          case 'sla_quebrado':
          case 'fila_atendimento':
          case 'sla_por_membro':
          case 'funil_visual':
          case 'ranking_vendedores':
          case 'deals_sem_acao':
          case 'leads_por_origem':
          case 'leads_duplicados':
          case 'taxa_qualificacao':
          case 'leads_reativados':
          case 'mensagens_whatsapp':
          case 'taxa_entrega':
          case 'taxa_falha':
          case 'status_chips':
          case 'resolvidos_bot':
          case 'transferidos_humano':
          case 'taxa_sucesso_bot':
          case 'erros_fluxo':
          case 'saldo_disponivel':
          case 'recebido_periodo':
          case 'a_receber':
          case 'inadimplencia':
          case 'mrr_atual':
          case 'previsao_30dias':
          case 'proximas_tarefas':
          case 'taxa_conclusao':
          case 'alertas_criticos':
          case 'alertas_aviso':
          case 'painel_alertas':
          case 'membros_online':
          case 'performance_equipe':
          case 'ranking_membros':
          case 'carga_trabalho': {
            result = { value: '-', subValue: 'Em desenvolvimento' };
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
