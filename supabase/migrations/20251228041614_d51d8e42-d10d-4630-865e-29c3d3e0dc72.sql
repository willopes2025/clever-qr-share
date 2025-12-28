-- Add new notification columns for task events
ALTER TABLE notification_preferences 
  ADD COLUMN IF NOT EXISTS notify_task_created boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_task_updated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_task_deleted boolean DEFAULT false;

-- Add responsible_id to funnel_deals
ALTER TABLE funnel_deals 
  ADD COLUMN IF NOT EXISTS responsible_id uuid REFERENCES auth.users(id);

-- Create index for faster queries on responsible_id
CREATE INDEX IF NOT EXISTS idx_funnel_deals_responsible_id ON funnel_deals(responsible_id);