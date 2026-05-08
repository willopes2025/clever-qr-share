
-- Meta Messenger / Instagram accounts (Pages + IG Business)
CREATE TABLE public.meta_messenger_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID,
  page_id TEXT NOT NULL,
  page_name TEXT,
  page_access_token TEXT NOT NULL,
  page_category TEXT,
  ig_business_account_id TEXT,
  ig_username TEXT,
  profile_picture_url TEXT,
  status TEXT NOT NULL DEFAULT 'connected',
  platforms TEXT[] NOT NULL DEFAULT ARRAY['messenger']::TEXT[],
  webhook_subscribed BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, page_id)
);

CREATE INDEX idx_meta_messenger_accounts_user ON public.meta_messenger_accounts(user_id);
CREATE INDEX idx_meta_messenger_accounts_page ON public.meta_messenger_accounts(page_id);
CREATE INDEX idx_meta_messenger_accounts_ig ON public.meta_messenger_accounts(ig_business_account_id) WHERE ig_business_account_id IS NOT NULL;

ALTER TABLE public.meta_messenger_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view messenger accounts"
ON public.meta_messenger_accounts
FOR SELECT TO authenticated
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Owners can insert messenger accounts"
ON public.meta_messenger_accounts
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can update messenger accounts"
ON public.meta_messenger_accounts
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can delete messenger accounts"
ON public.meta_messenger_accounts
FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_meta_messenger_accounts_updated_at
BEFORE UPDATE ON public.meta_messenger_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Webhook events log
CREATE TABLE public.meta_messenger_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  account_id UUID REFERENCES public.meta_messenger_accounts(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  event_type TEXT,
  page_id TEXT,
  ig_business_account_id TEXT,
  sender_id TEXT,
  recipient_id TEXT,
  method TEXT NOT NULL DEFAULT 'POST',
  status_code INT,
  signature_valid BOOLEAN,
  payload JSONB,
  processed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meta_messenger_events_user ON public.meta_messenger_webhook_events(user_id);
CREATE INDEX idx_meta_messenger_events_received ON public.meta_messenger_webhook_events(received_at DESC);
CREATE INDEX idx_meta_messenger_events_account ON public.meta_messenger_webhook_events(account_id);

ALTER TABLE public.meta_messenger_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view messenger webhook events"
ON public.meta_messenger_webhook_events
FOR SELECT TO authenticated
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));
