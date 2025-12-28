-- Add is_notification_only column to whatsapp_instances table
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS is_notification_only BOOLEAN DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.whatsapp_instances.is_notification_only IS 'Indicates if this instance is dedicated for sending notifications only';