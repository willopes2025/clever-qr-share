-- Criar tabela para mensagens agendadas vinculadas a tarefas
CREATE TABLE public.scheduled_task_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.conversation_tasks(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  message_content TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_task_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para members da organização
CREATE POLICY "Users can view scheduled messages of their org" 
ON public.scheduled_task_messages 
FOR SELECT 
USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can create scheduled messages" 
ON public.scheduled_task_messages 
FOR INSERT 
WITH CHECK (user_id IN (SELECT get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can update scheduled messages of their org" 
ON public.scheduled_task_messages 
FOR UPDATE 
USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can delete scheduled messages of their org" 
ON public.scheduled_task_messages 
FOR DELETE 
USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_scheduled_task_messages_updated_at
BEFORE UPDATE ON public.scheduled_task_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_scheduled_task_messages_task_id ON public.scheduled_task_messages(task_id);
CREATE INDEX idx_scheduled_task_messages_status ON public.scheduled_task_messages(status);
CREATE INDEX idx_scheduled_task_messages_scheduled_at ON public.scheduled_task_messages(scheduled_at);
CREATE INDEX idx_scheduled_task_messages_user_id ON public.scheduled_task_messages(user_id);