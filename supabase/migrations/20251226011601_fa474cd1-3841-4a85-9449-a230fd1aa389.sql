-- Drop the old constraint
ALTER TABLE public.ai_agent_configs DROP CONSTRAINT IF EXISTS ai_agent_configs_response_mode_check;

-- Add the new constraint with 'adaptive' option
ALTER TABLE public.ai_agent_configs 
ADD CONSTRAINT ai_agent_configs_response_mode_check 
CHECK (response_mode IN ('text', 'audio', 'both', 'adaptive'));