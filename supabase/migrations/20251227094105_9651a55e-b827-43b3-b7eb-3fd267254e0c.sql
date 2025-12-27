-- Criar tabela de tipos de tarefa
CREATE TABLE public.task_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  is_default BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_types
CREATE POLICY "Users can view organization task types"
ON public.task_types FOR SELECT
USING (
  user_id = auth.uid() 
  OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
);

CREATE POLICY "Users can create their own task types"
ON public.task_types FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own task types"
ON public.task_types FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task types"
ON public.task_types FOR DELETE
USING (auth.uid() = user_id);

-- Criar tabela de integração com Google Calendar
CREATE TABLE public.google_calendar_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  calendar_id TEXT DEFAULT 'primary',
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_calendar_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for google_calendar_integrations
CREATE POLICY "Users can view their own google calendar integration"
ON public.google_calendar_integrations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own google calendar integration"
ON public.google_calendar_integrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own google calendar integration"
ON public.google_calendar_integrations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own google calendar integration"
ON public.google_calendar_integrations FOR DELETE
USING (auth.uid() = user_id);

-- Alterar conversation_tasks para incluir novos campos
ALTER TABLE public.conversation_tasks 
ADD COLUMN task_type_id UUID REFERENCES public.task_types(id) ON DELETE SET NULL,
ADD COLUMN assigned_to UUID,
ADD COLUMN google_event_id TEXT,
ADD COLUMN sync_with_google BOOLEAN DEFAULT false;

-- Alterar deal_tasks para incluir novos campos
ALTER TABLE public.deal_tasks 
ADD COLUMN task_type_id UUID REFERENCES public.task_types(id) ON DELETE SET NULL,
ADD COLUMN assigned_to UUID,
ADD COLUMN due_time TIME,
ADD COLUMN google_event_id TEXT,
ADD COLUMN sync_with_google BOOLEAN DEFAULT false;

-- Criar índices
CREATE INDEX idx_task_types_user_id ON public.task_types(user_id);
CREATE INDEX idx_conversation_tasks_task_type_id ON public.conversation_tasks(task_type_id);
CREATE INDEX idx_conversation_tasks_assigned_to ON public.conversation_tasks(assigned_to);
CREATE INDEX idx_deal_tasks_task_type_id ON public.deal_tasks(task_type_id);
CREATE INDEX idx_deal_tasks_assigned_to ON public.deal_tasks(assigned_to);

-- Trigger para updated_at no google_calendar_integrations
CREATE TRIGGER update_google_calendar_integrations_updated_at
BEFORE UPDATE ON public.google_calendar_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();