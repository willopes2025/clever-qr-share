-- Create campaign_messages table for individual message tracking
CREATE TABLE public.campaign_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  contact_name TEXT,
  message_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies (access through campaign ownership)
CREATE POLICY "Users can view their campaign messages"
ON public.campaign_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.campaigns
  WHERE campaigns.id = campaign_messages.campaign_id
  AND campaigns.user_id = auth.uid()
));

CREATE POLICY "Users can insert their campaign messages"
ON public.campaign_messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.campaigns
  WHERE campaigns.id = campaign_messages.campaign_id
  AND campaigns.user_id = auth.uid()
));

CREATE POLICY "Users can update their campaign messages"
ON public.campaign_messages FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.campaigns
  WHERE campaigns.id = campaign_messages.campaign_id
  AND campaigns.user_id = auth.uid()
));

-- Indexes for performance
CREATE INDEX idx_campaign_messages_campaign_id ON public.campaign_messages(campaign_id);
CREATE INDEX idx_campaign_messages_status ON public.campaign_messages(status);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_messages;

-- Add instance_id column to campaigns table for tracking which instance is used
ALTER TABLE public.campaigns ADD COLUMN instance_id UUID REFERENCES public.whatsapp_instances(id);