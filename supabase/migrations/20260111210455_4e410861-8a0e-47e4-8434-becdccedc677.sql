-- Create table to log all Meta webhook events for debugging
CREATE TABLE public.meta_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  method TEXT NOT NULL,
  status_code INTEGER,
  phone_number_id TEXT,
  event_type TEXT,
  payload JSONB,
  error TEXT,
  signature_valid BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meta_webhook_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own webhook events
CREATE POLICY "Users can view their own webhook events"
ON public.meta_webhook_events
FOR SELECT
USING (auth.uid() = user_id);

-- Service role can insert events (from edge function)
CREATE POLICY "Service role can insert webhook events"
ON public.meta_webhook_events
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_meta_webhook_events_user_received ON public.meta_webhook_events(user_id, received_at DESC);
CREATE INDEX idx_meta_webhook_events_phone_number ON public.meta_webhook_events(phone_number_id);