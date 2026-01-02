-- Criar tabela de log de atividades do contato
CREATE TABLE public.contact_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ai_agent_id UUID REFERENCES ai_agent_configs(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_contact_activity_contact ON contact_activity_log(contact_id);
CREATE INDEX idx_contact_activity_created ON contact_activity_log(created_at DESC);
CREATE INDEX idx_contact_activity_conversation ON contact_activity_log(conversation_id);

-- RLS
ALTER TABLE contact_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organization activity logs"
ON contact_activity_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM contacts c
    WHERE c.id = contact_activity_log.contact_id
    AND (c.user_id = auth.uid() OR c.user_id IN (SELECT get_organization_member_ids(auth.uid())))
  )
);

CREATE POLICY "Users can create activity logs"
ON contact_activity_log FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM contacts c
    WHERE c.id = contact_activity_log.contact_id
    AND (c.user_id = auth.uid() OR c.user_id IN (SELECT get_organization_member_ids(auth.uid())))
  )
);

-- Adicionar campos em inbox_messages para identificar IA
ALTER TABLE inbox_messages 
  ADD COLUMN IF NOT EXISTS sent_by_ai_agent_id UUID REFERENCES ai_agent_configs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT false;

-- Trigger para logar criação/edição de contatos
CREATE OR REPLACE FUNCTION log_contact_activity() 
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO contact_activity_log (contact_id, user_id, activity_type, description, metadata)
    VALUES (NEW.id, NEW.user_id, 'contact_created', 'Contato criado', 
      jsonb_build_object('name', NEW.name, 'phone', NEW.phone));
  ELSIF TG_OP = 'UPDATE' THEN
    -- Só loga se houve mudança real nos dados principais
    IF OLD.name IS DISTINCT FROM NEW.name 
       OR OLD.email IS DISTINCT FROM NEW.email 
       OR OLD.phone IS DISTINCT FROM NEW.phone
       OR OLD.custom_fields IS DISTINCT FROM NEW.custom_fields THEN
      INSERT INTO contact_activity_log (contact_id, user_id, activity_type, description, metadata)
      VALUES (NEW.id, NEW.user_id, 'contact_edited', 'Dados do contato atualizados', 
        jsonb_build_object(
          'old_name', OLD.name, 
          'new_name', NEW.name,
          'old_email', OLD.email,
          'new_email', NEW.email
        ));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contact_activity
  AFTER INSERT OR UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION log_contact_activity();

-- Trigger para logar movimentações de deal
CREATE OR REPLACE FUNCTION log_deal_movement_activity() 
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id UUID;
  v_from_stage_name TEXT;
  v_to_stage_name TEXT;
BEGIN
  SELECT contact_id INTO v_contact_id FROM funnel_deals WHERE id = NEW.deal_id;
  
  IF v_contact_id IS NOT NULL THEN
    SELECT name INTO v_from_stage_name FROM funnel_stages WHERE id = NEW.from_stage_id;
    SELECT name INTO v_to_stage_name FROM funnel_stages WHERE id = NEW.to_stage_id;
    
    INSERT INTO contact_activity_log (contact_id, user_id, activity_type, description, metadata)
    VALUES (
      v_contact_id, 
      NEW.changed_by,
      'deal_moved', 
      COALESCE(NEW.notes, 'Negócio movido de etapa'),
      jsonb_build_object(
        'deal_id', NEW.deal_id, 
        'from_stage_id', NEW.from_stage_id, 
        'to_stage_id', NEW.to_stage_id,
        'from_stage_name', v_from_stage_name,
        'to_stage_name', v_to_stage_name
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deal_movement_activity
  AFTER INSERT ON funnel_deal_history
  FOR EACH ROW EXECUTE FUNCTION log_deal_movement_activity();

-- Trigger para logar notas adicionadas
CREATE OR REPLACE FUNCTION log_note_activity() 
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    INSERT INTO contact_activity_log (contact_id, conversation_id, user_id, activity_type, description, metadata)
    VALUES (
      NEW.contact_id,
      NEW.conversation_id,
      NEW.user_id,
      'note_added',
      'Nota adicionada',
      jsonb_build_object('note_preview', LEFT(NEW.content, 100))
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_note_activity
  AFTER INSERT ON conversation_notes
  FOR EACH ROW EXECUTE FUNCTION log_note_activity();

-- Trigger para logar tarefas
CREATE OR REPLACE FUNCTION log_task_activity() 
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO contact_activity_log (contact_id, conversation_id, user_id, activity_type, description, metadata)
      VALUES (
        NEW.contact_id,
        NEW.conversation_id,
        NEW.user_id,
        'task_created',
        'Tarefa criada: ' || NEW.title,
        jsonb_build_object('task_id', NEW.id, 'title', NEW.title, 'due_date', NEW.due_date)
      );
    ELSIF TG_OP = 'UPDATE' AND OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
      INSERT INTO contact_activity_log (contact_id, conversation_id, user_id, activity_type, description, metadata)
      VALUES (
        NEW.contact_id,
        NEW.conversation_id,
        NEW.user_id,
        'task_completed',
        'Tarefa concluída: ' || NEW.title,
        jsonb_build_object('task_id', NEW.id, 'title', NEW.title)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_activity
  AFTER INSERT OR UPDATE ON conversation_tasks
  FOR EACH ROW EXECUTE FUNCTION log_task_activity();