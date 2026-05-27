ALTER TABLE public.inbox_messages
  ADD COLUMN IF NOT EXISTS sent_via_chatbot_flow_id uuid REFERENCES public.chatbot_flows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_via_template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_via_meta_template_id uuid REFERENCES public.meta_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_messages_chatbot_flow ON public.inbox_messages(sent_via_chatbot_flow_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_template ON public.inbox_messages(sent_via_template_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_meta_template ON public.inbox_messages(sent_via_meta_template_id);