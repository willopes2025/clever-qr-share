
-- ============ email_channels ============
CREATE TABLE public.email_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gmail','outlook','imap')),
  email_address TEXT NOT NULL,
  display_name TEXT,
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  oauth_token_expires_at TIMESTAMPTZ,
  oauth_scope TEXT,
  gmail_history_id TEXT,
  last_synced_at TIMESTAMPTZ,
  imap_host TEXT, imap_port INT, imap_username TEXT, imap_password TEXT, imap_use_ssl BOOLEAN,
  smtp_host TEXT, smtp_port INT, smtp_username TEXT, smtp_password TEXT, smtp_use_tls BOOLEAN,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disconnected','error')),
  last_error TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email_address)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_channels TO authenticated;
GRANT ALL ON public.email_channels TO service_role;
ALTER TABLE public.email_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view email channels" ON public.email_channels
  FOR SELECT TO authenticated
  USING (organization_id = public.resolve_user_organization_id(auth.uid()));

CREATE POLICY "org admins manage email channels" ON public.email_channels
  FOR ALL TO authenticated
  USING (organization_id = public.resolve_user_organization_id(auth.uid()) AND public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (organization_id = public.resolve_user_organization_id(auth.uid()) AND public.is_org_admin(organization_id, auth.uid()));

-- ============ email_threads ============
CREATE TABLE public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.email_channels(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  subject TEXT,
  provider_thread_id TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INT NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_id, provider_thread_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_threads TO authenticated;
GRANT ALL ON public.email_threads TO service_role;
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members manage email threads" ON public.email_threads
  FOR ALL TO authenticated
  USING (organization_id = public.resolve_user_organization_id(auth.uid()))
  WITH CHECK (organization_id = public.resolve_user_organization_id(auth.uid()));

CREATE INDEX idx_email_threads_org_last ON public.email_threads(organization_id, last_message_at DESC);
CREATE INDEX idx_email_threads_contact ON public.email_threads(contact_id);

-- ============ email_messages ============
CREATE TABLE public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.email_channels(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES public.email_threads(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  provider_message_id TEXT,
  in_reply_to TEXT,
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_addresses TEXT[] NOT NULL DEFAULT '{}',
  cc_addresses TEXT[] NOT NULL DEFAULT '{}',
  bcc_addresses TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  snippet TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  sent_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'delivered' CHECK (status IN ('queued','sending','delivered','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_id, provider_message_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_messages TO authenticated;
GRANT ALL ON public.email_messages TO service_role;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members manage email messages" ON public.email_messages
  FOR ALL TO authenticated
  USING (organization_id = public.resolve_user_organization_id(auth.uid()))
  WITH CHECK (organization_id = public.resolve_user_organization_id(auth.uid()));

CREATE INDEX idx_email_messages_thread ON public.email_messages(thread_id, sent_at DESC);
CREATE INDEX idx_email_messages_contact ON public.email_messages(contact_id);
CREATE INDEX idx_email_messages_org ON public.email_messages(organization_id, created_at DESC);

-- ============ email_attachments ============
CREATE TABLE public.email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.email_messages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  storage_path TEXT,
  provider_attachment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_attachments TO authenticated;
GRANT ALL ON public.email_attachments TO service_role;
ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members manage email attachments" ON public.email_attachments
  FOR ALL TO authenticated
  USING (organization_id = public.resolve_user_organization_id(auth.uid()))
  WITH CHECK (organization_id = public.resolve_user_organization_id(auth.uid()));

-- ============ email_templates ============
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  variables TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view templates" ON public.email_templates
  FOR SELECT TO authenticated
  USING (organization_id = public.resolve_user_organization_id(auth.uid()));

CREATE POLICY "org members create templates" ON public.email_templates
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.resolve_user_organization_id(auth.uid()));

CREATE POLICY "org members update templates" ON public.email_templates
  FOR UPDATE TO authenticated
  USING (organization_id = public.resolve_user_organization_id(auth.uid()))
  WITH CHECK (organization_id = public.resolve_user_organization_id(auth.uid()));

CREATE POLICY "org admins delete templates" ON public.email_templates
  FOR DELETE TO authenticated
  USING (organization_id = public.resolve_user_organization_id(auth.uid()) AND public.is_org_admin(organization_id, auth.uid()));

-- ============ triggers ============
CREATE TRIGGER trg_email_channels_updated BEFORE UPDATE ON public.email_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_email_threads_updated BEFORE UPDATE ON public.email_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_email_templates_updated BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
