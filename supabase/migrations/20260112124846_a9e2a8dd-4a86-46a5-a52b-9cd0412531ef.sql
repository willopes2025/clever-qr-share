-- Add emoji control columns to ai_agent_configs
ALTER TABLE ai_agent_configs
ADD COLUMN IF NOT EXISTS pause_emoji TEXT DEFAULT '🛑',
ADD COLUMN IF NOT EXISTS resume_emoji TEXT DEFAULT '✅';

COMMENT ON COLUMN ai_agent_configs.pause_emoji IS 'Emoji que desliga o agente quando enviado pelo atendente';
COMMENT ON COLUMN ai_agent_configs.resume_emoji IS 'Emoji que religa o agente quando enviado pelo atendente';