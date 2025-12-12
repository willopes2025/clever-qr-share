-- Create user_settings table
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  
  -- Sending settings
  message_interval_min INTEGER NOT NULL DEFAULT 3,
  message_interval_max INTEGER NOT NULL DEFAULT 10,
  daily_limit INTEGER NOT NULL DEFAULT 1000,
  allowed_start_hour INTEGER NOT NULL DEFAULT 8,
  allowed_end_hour INTEGER NOT NULL DEFAULT 20,
  allowed_days TEXT[] NOT NULL DEFAULT ARRAY['mon','tue','wed','thu','fri'],
  
  -- Campaign settings
  stop_on_error BOOLEAN NOT NULL DEFAULT false,
  notify_on_complete BOOLEAN NOT NULL DEFAULT true,
  auto_retry BOOLEAN NOT NULL DEFAULT true,
  max_retries INTEGER NOT NULL DEFAULT 3,
  
  -- Notifications
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  
  -- Timezone
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own settings"
ON public.user_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings"
ON public.user_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
ON public.user_settings FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();