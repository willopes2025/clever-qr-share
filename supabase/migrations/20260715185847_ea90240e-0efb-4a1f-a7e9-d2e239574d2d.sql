
-- Adicionar send_email ao enum de ações do funil
ALTER TYPE public.funnel_action_type ADD VALUE IF NOT EXISTS 'send_email';

-- Campanhas de e-mail em massa
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  channel_id UUID NOT NULL REFERENCES public.email_channels(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  source_type TEXT NOT NULL,
  source_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  batch_size INT NOT NULL DEFAULT 20,
  batch_interval_seconds INT NOT NULL DEFAULT 60,
  send_window JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_start_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_dispatch_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaigns TO authenticated;
GRANT ALL ON public.email_campaigns TO service_role;

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read campaigns" ON public.email_campaigns FOR SELECT TO authenticated
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));
CREATE POLICY "org members insert campaigns" ON public.email_campaigns FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND organization_id = public.resolve_user_organization_id(auth.uid()));
CREATE POLICY "org members update campaigns" ON public.email_campaigns FOR UPDATE TO authenticated
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));
CREATE POLICY "org members delete campaigns" ON public.email_campaigns FOR DELETE TO authenticated
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE TRIGGER email_campaigns_set_updated_at BEFORE UPDATE ON public.email_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Destinatários da campanha (fila + histórico)
CREATE TABLE IF NOT EXISTS public.email_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  attempts INT NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  provider_thread_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, email)
);

CREATE INDEX IF NOT EXISTS idx_ecr_campaign_status ON public.email_campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_ecr_pending ON public.email_campaign_recipients(status, scheduled_at) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaign_recipients TO authenticated;
GRANT ALL ON public.email_campaign_recipients TO service_role;

ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read recipients" ON public.email_campaign_recipients FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.email_campaigns c WHERE c.id = campaign_id
  AND c.user_id IN (SELECT public.get_organization_member_ids(auth.uid()))));
CREATE POLICY "org members insert recipients" ON public.email_campaign_recipients FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.email_campaigns c WHERE c.id = campaign_id
  AND c.user_id IN (SELECT public.get_organization_member_ids(auth.uid()))));
CREATE POLICY "org members update recipients" ON public.email_campaign_recipients FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.email_campaigns c WHERE c.id = campaign_id
  AND c.user_id IN (SELECT public.get_organization_member_ids(auth.uid()))));
CREATE POLICY "org members delete recipients" ON public.email_campaign_recipients FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.email_campaigns c WHERE c.id = campaign_id
  AND c.user_id IN (SELECT public.get_organization_member_ids(auth.uid()))));

CREATE TRIGGER email_campaign_recipients_set_updated_at BEFORE UPDATE ON public.email_campaign_recipients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
