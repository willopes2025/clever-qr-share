-- Tabela para sessões de atividade do usuário (login, pausas, almoço)
CREATE TABLE public.user_activity_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL DEFAULT 'work' CHECK (session_type IN ('work', 'break', 'lunch', 'meeting', 'offline')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para histórico de status do usuário
CREATE TABLE public.user_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'away', 'busy', 'break', 'lunch', 'offline')),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT,
  auto_detected BOOLEAN DEFAULT false
);

-- Tabela para métricas de performance diárias
CREATE TABLE public.user_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_work_seconds INTEGER DEFAULT 0,
  total_break_seconds INTEGER DEFAULT 0,
  total_lunch_seconds INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  conversations_handled INTEGER DEFAULT 0,
  conversations_resolved INTEGER DEFAULT 0,
  deals_created INTEGER DEFAULT 0,
  deals_won INTEGER DEFAULT 0,
  deals_value NUMERIC(15,2) DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  avg_response_time_seconds INTEGER,
  first_activity_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, metric_date)
);

-- Índices para performance
CREATE INDEX idx_user_activity_sessions_user_id ON public.user_activity_sessions(user_id);
CREATE INDEX idx_user_activity_sessions_org_id ON public.user_activity_sessions(organization_id);
CREATE INDEX idx_user_activity_sessions_started_at ON public.user_activity_sessions(started_at);
CREATE INDEX idx_user_status_history_user_id ON public.user_status_history(user_id);
CREATE INDEX idx_user_status_history_changed_at ON public.user_status_history(changed_at);
CREATE INDEX idx_user_performance_metrics_user_date ON public.user_performance_metrics(user_id, metric_date);
CREATE INDEX idx_user_performance_metrics_org_date ON public.user_performance_metrics(organization_id, metric_date);

-- Habilitar RLS
ALTER TABLE public.user_activity_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_activity_sessions
CREATE POLICY "Users can view their own sessions"
ON public.user_activity_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions"
ON public.user_activity_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
ON public.user_activity_sessions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Org members can view org sessions"
ON public.user_activity_sessions FOR SELECT
USING (organization_id IN (
  SELECT tm.organization_id FROM public.team_members tm 
  WHERE tm.user_id = auth.uid() AND tm.status = 'active'
));

-- Políticas RLS para user_status_history
CREATE POLICY "Users can view their own status history"
ON public.user_status_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own status"
ON public.user_status_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Org members can view org status history"
ON public.user_status_history FOR SELECT
USING (organization_id IN (
  SELECT tm.organization_id FROM public.team_members tm 
  WHERE tm.user_id = auth.uid() AND tm.status = 'active'
));

-- Políticas RLS para user_performance_metrics
CREATE POLICY "Users can view their own metrics"
ON public.user_performance_metrics FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own metrics"
ON public.user_performance_metrics FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Org members can view org metrics"
ON public.user_performance_metrics FOR SELECT
USING (organization_id IN (
  SELECT tm.organization_id FROM public.team_members tm 
  WHERE tm.user_id = auth.uid() AND tm.status = 'active'
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_user_performance_metrics_updated_at
BEFORE UPDATE ON public.user_performance_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar Realtime para status em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_activity_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_status_history;