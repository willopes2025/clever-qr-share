-- Create ai_agent_stages table for conversation flow management
CREATE TABLE public.ai_agent_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_config_id UUID NOT NULL REFERENCES public.ai_agent_configs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  stage_name TEXT NOT NULL,
  stage_prompt TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  collected_fields JSONB DEFAULT '[]'::jsonb,
  completion_condition JSONB DEFAULT '{}'::jsonb,
  condition_type TEXT NOT NULL DEFAULT 'field_filled' CHECK (condition_type IN ('field_filled', 'keyword_match', 'intent_detected', 'manual', 'always')),
  next_stage_id UUID REFERENCES public.ai_agent_stages(id) ON DELETE SET NULL,
  is_final BOOLEAN DEFAULT false,
  actions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_agent_stages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own stages"
  ON public.ai_agent_stages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own stages"
  ON public.ai_agent_stages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stages"
  ON public.ai_agent_stages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stages"
  ON public.ai_agent_stages FOR DELETE
  USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_ai_agent_stages_updated_at
  BEFORE UPDATE ON public.ai_agent_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add current_stage_id foreign key to conversation_stage_data if not exists
-- First drop if exists to recreate with proper reference
ALTER TABLE public.conversation_stage_data 
  DROP CONSTRAINT IF EXISTS conversation_stage_data_current_stage_id_fkey;

ALTER TABLE public.conversation_stage_data 
  ADD CONSTRAINT conversation_stage_data_current_stage_id_fkey 
  FOREIGN KEY (current_stage_id) REFERENCES public.ai_agent_stages(id) ON DELETE SET NULL;