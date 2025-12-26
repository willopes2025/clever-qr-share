-- Add preferred_response_format column to conversations table
ALTER TABLE public.conversations
ADD COLUMN preferred_response_format TEXT DEFAULT NULL;

-- Add check constraint for valid values
ALTER TABLE public.conversations
ADD CONSTRAINT check_preferred_response_format CHECK (preferred_response_format IN ('text', 'audio') OR preferred_response_format IS NULL);

COMMENT ON COLUMN public.conversations.preferred_response_format IS 'Client preferred response format: text, audio, or null (adaptive/mirroring)';