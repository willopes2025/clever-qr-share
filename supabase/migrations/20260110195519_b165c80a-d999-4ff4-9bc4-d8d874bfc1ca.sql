-- Create table for available widgets catalog
CREATE TABLE public.available_widgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  widget_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  icon TEXT,
  size_options TEXT[] DEFAULT ARRAY['small', 'medium', 'large'],
  default_size TEXT DEFAULT 'medium',
  admin_only BOOLEAN DEFAULT false,
  member_only BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for user dashboard configurations
CREATE TABLE public.dashboard_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  config_type TEXT NOT NULL DEFAULT 'personal' CHECK (config_type IN ('personal', 'admin_template', 'member_template')),
  name TEXT NOT NULL DEFAULT 'Meu Dashboard',
  widgets JSONB DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.available_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for available_widgets (read-only for all authenticated users)
CREATE POLICY "Anyone can view active widgets" 
ON public.available_widgets 
FOR SELECT 
USING (is_active = true);

-- RLS Policies for dashboard_configs
CREATE POLICY "Users can view their own dashboard configs" 
ON public.dashboard_configs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dashboard configs" 
ON public.dashboard_configs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboard configs" 
ON public.dashboard_configs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboard configs" 
ON public.dashboard_configs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_dashboard_configs_updated_at
BEFORE UPDATE ON public.dashboard_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert all available widgets catalog
INSERT INTO public.available_widgets (widget_key, name, description, category, icon, default_size, admin_only, member_only, display_order) VALUES
-- PERFORMANCE HOME OFFICE
('tempo_trabalhado_hoje', 'Tempo Trabalhado Hoje', 'Horas trabalhadas no dia atual', 'performance', 'Clock', 'small', false, false, 1),
('tempo_em_pausa', 'Tempo em Pausa', 'Total de pausas realizadas hoje', 'performance', 'Pause', 'small', false, false, 2),
('primeira_atividade', 'Primeira Atividade', 'Horário de início do expediente', 'performance', 'Sunrise', 'small', false, false, 3),
('ultima_atividade', 'Última Atividade', 'Horário da última ação registrada', 'performance', 'Sunset', 'small', false, false, 4),
('taxa_produtividade', 'Taxa de Produtividade', 'Percentual trabalho vs pausas', 'performance', 'TrendingUp', 'small', false, false, 5),
('meta_horas_diarias', 'Meta de Horas Diárias', 'Progresso da meta de horas', 'performance', 'Target', 'medium', false, false, 6),
('streak_dias', 'Streak de Dias', 'Dias consecutivos trabalhados', 'performance', 'Flame', 'small', false, false, 7),
('horas_semana', 'Horas na Semana', 'Total de horas trabalhadas na semana', 'performance', 'Calendar', 'small', false, false, 8),

-- MENSAGENS E ATENDIMENTO
('mensagens_enviadas', 'Mensagens Enviadas', 'Total de mensagens enviadas hoje', 'atendimento', 'Send', 'small', false, false, 10),
('mensagens_recebidas', 'Mensagens Recebidas', 'Total de mensagens recebidas hoje', 'atendimento', 'MessageSquare', 'small', false, false, 11),
('conversas_ativas', 'Conversas Ativas', 'Conversas em atendimento', 'atendimento', 'MessageCircle', 'small', false, false, 12),
('conversas_resolvidas', 'Conversas Resolvidas', 'Conversas finalizadas hoje', 'atendimento', 'CheckCircle', 'small', false, false, 13),
('tempo_medio_resposta', 'Tempo Médio de Resposta', 'Tempo médio para primeira resposta', 'atendimento', 'Timer', 'small', false, false, 14),
('taxa_resposta', 'Taxa de Resposta', 'Percentual de conversas respondidas', 'atendimento', 'Percent', 'small', false, false, 15),
('conversas_sem_resposta', 'Conversas Sem Resposta', 'Aguardando atendimento', 'atendimento', 'AlertCircle', 'medium', false, false, 16),
('sla_cumprido', 'SLA Cumprido', 'Percentual de SLA dentro do prazo', 'atendimento', 'Shield', 'small', false, false, 17),
('sla_quebrado', 'SLA Quebrado', 'Conversas fora do SLA', 'atendimento', 'ShieldAlert', 'medium', false, false, 18),
('fila_atendimento', 'Fila de Atendimento', 'Conversas na fila por prioridade', 'atendimento', 'ListOrdered', 'large', false, false, 19),
('sla_por_membro', 'SLA por Membro', 'Comparativo de SLA da equipe', 'atendimento', 'Users', 'large', true, false, 20),

-- VENDAS E FUNIL
('deals_criados', 'Deals Criados', 'Novos deals no período', 'vendas', 'Plus', 'small', false, false, 30),
('deals_ganhos', 'Deals Ganhos', 'Vendas fechadas com sucesso', 'vendas', 'Trophy', 'small', false, false, 31),
('deals_perdidos', 'Deals Perdidos', 'Deals marcados como perdidos', 'vendas', 'XCircle', 'small', false, false, 32),
('valor_pipeline', 'Valor em Pipeline', 'Total de valor em negociação', 'vendas', 'DollarSign', 'medium', false, false, 33),
('valor_ganho', 'Valor Ganho', 'Total de vendas realizadas', 'vendas', 'Banknote', 'medium', false, false, 34),
('taxa_conversao', 'Taxa de Conversão', 'Percentual de deals ganhos', 'vendas', 'TrendingUp', 'small', false, false, 35),
('ticket_medio', 'Ticket Médio', 'Valor médio por venda', 'vendas', 'Receipt', 'small', false, false, 36),
('ciclo_venda', 'Ciclo Médio de Venda', 'Dias médios até fechamento', 'vendas', 'Clock', 'small', false, false, 37),
('funil_visual', 'Funil Visual', 'Gráfico de funil por etapas', 'vendas', 'Filter', 'large', false, false, 38),
('ranking_vendedores', 'Ranking de Vendedores', 'Top vendedores do período', 'vendas', 'Award', 'large', true, false, 39),
('deals_sem_acao', 'Deals Sem Ação', 'Deals parados há muito tempo', 'vendas', 'AlertTriangle', 'medium', false, false, 40),

-- LEADS
('leads_hoje', 'Leads Hoje', 'Novos leads capturados hoje', 'leads', 'UserPlus', 'small', false, false, 50),
('leads_semana', 'Leads na Semana', 'Total de leads da semana', 'leads', 'Users', 'small', false, false, 51),
('leads_mes', 'Leads no Mês', 'Total de leads do mês', 'leads', 'UsersRound', 'small', false, false, 52),
('leads_por_origem', 'Leads por Origem', 'Distribuição por fonte de captação', 'leads', 'PieChart', 'medium', false, false, 53),
('leads_duplicados', 'Leads Duplicados', 'Leads com telefone repetido', 'leads', 'Copy', 'small', false, false, 54),
('taxa_qualificacao', 'Taxa de Qualificação', 'Leads que avançaram no funil', 'leads', 'Target', 'small', false, false, 55),
('leads_reativados', 'Leads Reativados', 'Leads frios que voltaram', 'leads', 'RefreshCw', 'small', false, false, 56),

-- WHATSAPP
('chips_ativos', 'Chips Ativos', 'Instâncias WhatsApp conectadas', 'whatsapp', 'Smartphone', 'small', false, false, 60),
('chips_inativos', 'Chips Inativos', 'Instâncias desconectadas', 'whatsapp', 'SmartphoneOff', 'small', false, false, 61),
('mensagens_whatsapp', 'Mensagens WhatsApp', 'Total de mensagens enviadas', 'whatsapp', 'MessageSquare', 'small', false, false, 62),
('taxa_entrega', 'Taxa de Entrega', 'Percentual de mensagens entregues', 'whatsapp', 'CheckCheck', 'small', false, false, 63),
('taxa_falha', 'Taxa de Falha', 'Mensagens com erro de envio', 'whatsapp', 'XCircle', 'small', false, false, 64),
('status_chips', 'Status dos Chips', 'Visão geral de todas instâncias', 'whatsapp', 'Activity', 'large', true, false, 65),

-- AUTOMAÇÃO
('fluxos_ativos', 'Fluxos Ativos', 'Chatbots e automações rodando', 'automacao', 'Workflow', 'small', false, false, 70),
('execucoes_hoje', 'Execuções Hoje', 'Fluxos executados no dia', 'automacao', 'Play', 'small', false, false, 71),
('resolvidos_bot', 'Resolvidos por Bot', 'Atendimentos finalizados por IA', 'automacao', 'Bot', 'small', false, false, 72),
('transferidos_humano', 'Transferidos p/ Humano', 'Conversas encaminhadas', 'automacao', 'UserCheck', 'small', false, false, 73),
('taxa_sucesso_bot', 'Taxa Sucesso Bot', 'Eficiência das automações', 'automacao', 'Percent', 'small', false, false, 74),
('erros_fluxo', 'Erros de Fluxo', 'Falhas nas automações', 'automacao', 'AlertTriangle', 'medium', false, false, 75),

-- FINANCEIRO (Admin)
('saldo_disponivel', 'Saldo Disponível', 'Valor disponível para saque', 'financeiro', 'Wallet', 'medium', true, false, 80),
('recebido_periodo', 'Recebido no Período', 'Total recebido no período', 'financeiro', 'ArrowDownCircle', 'medium', true, false, 81),
('a_receber', 'A Receber', 'Valores pendentes de recebimento', 'financeiro', 'Clock', 'medium', true, false, 82),
('inadimplencia', 'Inadimplência', 'Valores em atraso', 'financeiro', 'AlertCircle', 'medium', true, false, 83),
('mrr_atual', 'MRR Atual', 'Receita recorrente mensal', 'financeiro', 'TrendingUp', 'medium', true, false, 84),
('previsao_30dias', 'Previsão 30 Dias', 'Estimativa de recebimentos', 'financeiro', 'Calendar', 'medium', true, false, 85),

-- TAREFAS
('tarefas_pendentes', 'Tarefas Pendentes', 'Tarefas a serem realizadas', 'tarefas', 'ListTodo', 'small', false, false, 90),
('tarefas_concluidas', 'Tarefas Concluídas', 'Tarefas finalizadas hoje', 'tarefas', 'CheckSquare', 'small', false, false, 91),
('tarefas_atrasadas', 'Tarefas Atrasadas', 'Tarefas com prazo vencido', 'tarefas', 'AlertTriangle', 'medium', false, false, 92),
('proximas_tarefas', 'Próximas Tarefas', 'Tarefas dos próximos dias', 'tarefas', 'CalendarDays', 'medium', false, false, 93),
('taxa_conclusao', 'Taxa de Conclusão', 'Percentual de tarefas feitas', 'tarefas', 'Percent', 'small', false, false, 94),

-- ALERTAS
('alertas_criticos', 'Alertas Críticos', 'Problemas urgentes do sistema', 'alertas', 'AlertOctagon', 'medium', false, false, 100),
('alertas_aviso', 'Alertas de Aviso', 'Situações que precisam atenção', 'alertas', 'AlertTriangle', 'medium', false, false, 101),
('painel_alertas', 'Painel de Alertas', 'Visão completa de alertas', 'alertas', 'Bell', 'large', false, false, 102),

-- EQUIPE (Admin)
('membros_online', 'Membros Online', 'Equipe atualmente ativa', 'equipe', 'Users', 'small', true, false, 110),
('performance_equipe', 'Performance da Equipe', 'Comparativo entre membros', 'equipe', 'BarChart', 'large', true, false, 111),
('ranking_membros', 'Ranking de Membros', 'Top performers do período', 'equipe', 'Medal', 'large', true, false, 112),
('carga_trabalho', 'Carga de Trabalho', 'Distribuição de conversas', 'equipe', 'Scale', 'medium', true, false, 113);