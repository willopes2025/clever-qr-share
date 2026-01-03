-- Tabela para sugestões de aprendizado do agente
CREATE TABLE public.ai_knowledge_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_config_id UUID NOT NULL REFERENCES ai_agent_configs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Dados extraídos
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  suggested_title TEXT,
  
  -- Contexto
  source_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  source_message_ids UUID[],
  analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Classificação
  confidence_score NUMERIC(3,2) DEFAULT 0.80,
  category TEXT DEFAULT 'geral',
  frequency_count INTEGER DEFAULT 1,
  
  -- Status
  status TEXT DEFAULT 'pending',
  dismissed_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);

-- Índices
CREATE INDEX idx_suggestions_agent ON ai_knowledge_suggestions(agent_config_id);
CREATE INDEX idx_suggestions_status ON ai_knowledge_suggestions(status);
CREATE INDEX idx_suggestions_date ON ai_knowledge_suggestions(analysis_date);
CREATE INDEX idx_suggestions_user ON ai_knowledge_suggestions(user_id);

-- Enable RLS
ALTER TABLE ai_knowledge_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own suggestions"
ON ai_knowledge_suggestions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own suggestions"
ON ai_knowledge_suggestions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggestions"
ON ai_knowledge_suggestions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own suggestions"
ON ai_knowledge_suggestions FOR DELETE
USING (auth.uid() = user_id);

-- Service role policy for edge functions
CREATE POLICY "Service role can manage all suggestions"
ON ai_knowledge_suggestions FOR ALL
USING (true)
WITH CHECK (true);