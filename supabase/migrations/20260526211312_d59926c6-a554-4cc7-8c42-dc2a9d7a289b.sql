-- Biblioteca de mídias reutilizáveis do agente de IA
CREATE TABLE public.ai_agent_media_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'audio', 'document')),
  media_url TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_media_library TO authenticated;
GRANT ALL ON public.ai_agent_media_library TO service_role;

ALTER TABLE public.ai_agent_media_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own or org media library"
  ON public.ai_agent_media_library FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Users insert own media library"
  ON public.ai_agent_media_library FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own or org media library"
  ON public.ai_agent_media_library FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Users delete own or org media library"
  ON public.ai_agent_media_library FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE TRIGGER update_ai_agent_media_library_updated_at
  BEFORE UPDATE ON public.ai_agent_media_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ai_agent_media_library_user ON public.ai_agent_media_library(user_id);

-- Vínculo de mídias com etapas do agente
CREATE TABLE public.ai_agent_stage_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES public.ai_agent_stages(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES public.ai_agent_media_library(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'on_enter' CHECK (trigger_type IN ('on_enter', 'on_demand', 'after_message')),
  order_index INTEGER NOT NULL DEFAULT 0,
  delay_seconds INTEGER NOT NULL DEFAULT 2,
  caption_override TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_stage_media TO authenticated;
GRANT ALL ON public.ai_agent_stage_media TO service_role;

ALTER TABLE public.ai_agent_stage_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own or org stage media"
  ON public.ai_agent_stage_media FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Users insert own stage media"
  ON public.ai_agent_stage_media FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own or org stage media"
  ON public.ai_agent_stage_media FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Users delete own or org stage media"
  ON public.ai_agent_stage_media FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE TRIGGER update_ai_agent_stage_media_updated_at
  BEFORE UPDATE ON public.ai_agent_stage_media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ai_agent_stage_media_stage ON public.ai_agent_stage_media(stage_id);
CREATE INDEX idx_ai_agent_stage_media_media ON public.ai_agent_stage_media(media_id);