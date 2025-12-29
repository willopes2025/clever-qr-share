-- Add ElevenLabs Agent ID column to ai_agent_configs
ALTER TABLE public.ai_agent_configs 
ADD COLUMN IF NOT EXISTS elevenlabs_agent_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.ai_agent_configs.elevenlabs_agent_id IS 'ElevenLabs Conversational AI Agent ID for voice calls';