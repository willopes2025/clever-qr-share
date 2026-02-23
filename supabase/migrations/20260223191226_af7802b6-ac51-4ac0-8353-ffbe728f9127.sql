
-- Add scheduled_resume_at column to chatbot_executions
ALTER TABLE public.chatbot_executions 
ADD COLUMN IF NOT EXISTS scheduled_resume_at TIMESTAMPTZ;

-- Create index for efficient scheduled flow lookup
CREATE INDEX IF NOT EXISTS idx_chatbot_executions_scheduled 
ON public.chatbot_executions (status, scheduled_resume_at) 
WHERE status = 'scheduled';
