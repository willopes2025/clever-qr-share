-- Add schedule columns to notification_preferences
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS schedule_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS schedule_days integer[] DEFAULT '{1,2,3,4,5}',
ADD COLUMN IF NOT EXISTS schedule_start_time time DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS schedule_end_time time DEFAULT '18:00';

-- Create notification_queue table for storing notifications outside schedule
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  notification_data jsonb NOT NULL,
  message text NOT NULL,
  phone text NOT NULL,
  instance_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  processed boolean DEFAULT false,
  processed_at timestamptz
);

-- Enable RLS
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS policy for users to view their own queued notifications
CREATE POLICY "Users can view own queued notifications"
ON public.notification_queue FOR SELECT
USING (user_id = auth.uid());

-- RLS policy for service role to insert/update
CREATE POLICY "Service role can manage notification queue"
ON public.notification_queue FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_queue_pending 
ON public.notification_queue(processed, user_id) 
WHERE processed = false;