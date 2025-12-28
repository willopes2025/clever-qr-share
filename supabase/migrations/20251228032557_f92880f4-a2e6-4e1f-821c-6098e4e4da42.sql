-- Adicionar campo phone na tabela team_members
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS phone text;

-- Adicionar campo phone na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- Criar tabela de preferências de notificação
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  
  -- Tipos de notificação (cada um pode ser ativado/desativado)
  notify_new_message boolean DEFAULT false,
  notify_new_deal boolean DEFAULT false,
  notify_deal_stage_change boolean DEFAULT false,
  notify_deal_assigned boolean DEFAULT true,
  notify_task_due boolean DEFAULT true,
  notify_task_assigned boolean DEFAULT true,
  notify_calendly_event boolean DEFAULT true,
  notify_ai_handoff boolean DEFAULT true,
  notify_campaign_complete boolean DEFAULT false,
  notify_instance_disconnect boolean DEFAULT true,
  
  -- Notificar apenas se for responsável
  only_if_responsible boolean DEFAULT true,
  
  -- Instância de WhatsApp para enviar notificações
  notification_instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para notification_preferences
CREATE POLICY "Users can view their own notification preferences"
ON public.notification_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notification preferences"
ON public.notification_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
ON public.notification_preferences FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification preferences"
ON public.notification_preferences FOR DELETE
USING (auth.uid() = user_id);

-- Criar tabela de log de notificações
CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_type text NOT NULL,
  message text NOT NULL,
  sent_to_phone text,
  related_id uuid,
  status text DEFAULT 'pending',
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para notification_log
CREATE POLICY "Users can view their own notification logs"
ON public.notification_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notification logs"
ON public.notification_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins da organização podem ver logs dos membros
CREATE POLICY "Admins can view organization notification logs"
ON public.notification_log FOR SELECT
USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));