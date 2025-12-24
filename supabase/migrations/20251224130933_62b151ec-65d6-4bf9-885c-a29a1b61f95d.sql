-- Create ai_agent_configs table
CREATE TABLE public.ai_agent_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL DEFAULT 'Assistente IA',
  personality_prompt TEXT,
  behavior_rules TEXT,
  greeting_message TEXT,
  fallback_message TEXT DEFAULT 'Desculpe, não entendi. Pode reformular?',
  goodbye_message TEXT,
  max_interactions INTEGER DEFAULT 10,
  response_delay_min INTEGER DEFAULT 3,
  response_delay_max INTEGER DEFAULT 8,
  active_hours_start INTEGER DEFAULT 8,
  active_hours_end INTEGER DEFAULT 20,
  handoff_keywords TEXT[] DEFAULT ARRAY['atendente', 'humano', 'pessoa', 'falar com alguém'],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create ai_agent_knowledge_items table
CREATE TABLE public.ai_agent_knowledge_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_config_id UUID NOT NULL REFERENCES public.ai_agent_configs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('text', 'pdf', 'url')),
  title TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  website_url TEXT,
  processed_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create ai_agent_variables table
CREATE TABLE public.ai_agent_variables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_config_id UUID NOT NULL REFERENCES public.ai_agent_configs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  variable_key TEXT NOT NULL,
  variable_value TEXT,
  variable_description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(agent_config_id, variable_key)
);

-- Create conversation_stage_data for future stages feature
CREATE TABLE public.conversation_stage_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  current_stage_id UUID,
  collected_data JSONB DEFAULT '{}'::jsonb,
  stage_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(conversation_id)
);

-- Enable RLS on all tables
ALTER TABLE public.ai_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_stage_data ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_agent_configs
CREATE POLICY "Users can view their own agent configs" ON public.ai_agent_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own agent configs" ON public.ai_agent_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own agent configs" ON public.ai_agent_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own agent configs" ON public.ai_agent_configs FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for ai_agent_knowledge_items
CREATE POLICY "Users can view their own knowledge items" ON public.ai_agent_knowledge_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own knowledge items" ON public.ai_agent_knowledge_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own knowledge items" ON public.ai_agent_knowledge_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own knowledge items" ON public.ai_agent_knowledge_items FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for ai_agent_variables
CREATE POLICY "Users can view their own variables" ON public.ai_agent_variables FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own variables" ON public.ai_agent_variables FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own variables" ON public.ai_agent_variables FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own variables" ON public.ai_agent_variables FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for conversation_stage_data
CREATE POLICY "Users can view their conversation stage data" ON public.conversation_stage_data FOR SELECT 
USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_stage_data.conversation_id AND conversations.user_id = auth.uid()));
CREATE POLICY "Users can create their conversation stage data" ON public.conversation_stage_data FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_stage_data.conversation_id AND conversations.user_id = auth.uid()));
CREATE POLICY "Users can update their conversation stage data" ON public.conversation_stage_data FOR UPDATE 
USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_stage_data.conversation_id AND conversations.user_id = auth.uid()));

-- Create storage bucket for AI knowledge files
INSERT INTO storage.buckets (id, name, public) VALUES ('ai-knowledge-files', 'ai-knowledge-files', false);

-- Storage policies for ai-knowledge-files bucket
CREATE POLICY "Users can upload their own knowledge files" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'ai-knowledge-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own knowledge files" ON storage.objects FOR SELECT 
USING (bucket_id = 'ai-knowledge-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own knowledge files" ON storage.objects FOR DELETE 
USING (bucket_id = 'ai-knowledge-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add triggers for updated_at
CREATE TRIGGER update_ai_agent_configs_updated_at BEFORE UPDATE ON public.ai_agent_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_agent_knowledge_items_updated_at BEFORE UPDATE ON public.ai_agent_knowledge_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_agent_variables_updated_at BEFORE UPDATE ON public.ai_agent_variables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conversation_stage_data_updated_at BEFORE UPDATE ON public.conversation_stage_data FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();