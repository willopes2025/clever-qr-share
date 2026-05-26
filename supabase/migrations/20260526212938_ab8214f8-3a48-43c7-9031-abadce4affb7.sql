ALTER TABLE public.ai_agent_stage_media
  ADD COLUMN IF NOT EXISTS attachment_type text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.message_templates(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS meta_template_id uuid REFERENCES public.meta_templates(id) ON DELETE CASCADE;

ALTER TABLE public.ai_agent_stage_media
  ALTER COLUMN media_id DROP NOT NULL;

ALTER TABLE public.ai_agent_stage_media
  DROP CONSTRAINT IF EXISTS ai_agent_stage_media_attachment_type_check;
ALTER TABLE public.ai_agent_stage_media
  ADD CONSTRAINT ai_agent_stage_media_attachment_type_check
  CHECK (attachment_type IN ('media','template','meta_template'));

ALTER TABLE public.ai_agent_stage_media
  DROP CONSTRAINT IF EXISTS ai_agent_stage_media_one_ref_check;
ALTER TABLE public.ai_agent_stage_media
  ADD CONSTRAINT ai_agent_stage_media_one_ref_check CHECK (
    (attachment_type = 'media' AND media_id IS NOT NULL AND template_id IS NULL AND meta_template_id IS NULL)
    OR (attachment_type = 'template' AND template_id IS NOT NULL AND media_id IS NULL AND meta_template_id IS NULL)
    OR (attachment_type = 'meta_template' AND meta_template_id IS NOT NULL AND media_id IS NULL AND template_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_ai_agent_stage_media_template ON public.ai_agent_stage_media(template_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_stage_media_meta_template ON public.ai_agent_stage_media(meta_template_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_stage_media_stage_trigger ON public.ai_agent_stage_media(stage_id, trigger_type);