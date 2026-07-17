CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_conversations_user_pinned_last_msg
ON public.conversations (user_id, is_pinned DESC, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_created_at_desc
ON public.contacts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_user_created_at_desc
ON public.contacts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm
ON public.contacts USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm
ON public.contacts USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_display_id_trgm
ON public.contacts USING gin (contact_display_id gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_funnel_deals_stage_updated_at
ON public.funnel_deals (stage_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_funnel_deals_funnel_stage
ON public.funnel_deals (funnel_id, stage_id);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_conversation_created_at
ON public.inbox_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_form_submissions_form_created_at
ON public.form_submissions (form_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_messages_contact_status_created
ON public.campaign_messages (contact_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_notification_only
ON public.whatsapp_instances (is_notification_only)
WHERE is_notification_only = true;

ANALYZE public.conversations;
ANALYZE public.contacts;
ANALYZE public.funnel_deals;
ANALYZE public.inbox_messages;
ANALYZE public.form_submissions;
ANALYZE public.campaign_messages;
ANALYZE public.whatsapp_instances;