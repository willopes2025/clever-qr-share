-- Adicionar campos de IA na tabela campaigns
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS ai_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_prompt text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_knowledge_base text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_max_interactions integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS ai_response_delay_min integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS ai_response_delay_max integer DEFAULT 8,
ADD COLUMN IF NOT EXISTS ai_handoff_keywords text[] DEFAULT ARRAY['atendente', 'humano', 'pessoa', 'falar com alguém']::text[],
ADD COLUMN IF NOT EXISTS ai_active_hours_start integer DEFAULT 8,
ADD COLUMN IF NOT EXISTS ai_active_hours_end integer DEFAULT 20;

-- Adicionar campos de IA na tabela conversations
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ai_handled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_interactions_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_paused boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_handoff_requested boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_handoff_reason text DEFAULT NULL;

-- Criar índice para buscar conversas por campanha
CREATE INDEX IF NOT EXISTS idx_conversations_campaign_id ON public.conversations(campaign_id);

-- Criar índice para buscar conversas com IA ativa
CREATE INDEX IF NOT EXISTS idx_conversations_ai_handled ON public.conversations(ai_handled) WHERE ai_handled = true;