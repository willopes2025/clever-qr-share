
-- =============================================
-- BROADCAST_LISTS: UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can update their own broadcast lists" ON public.broadcast_lists;
CREATE POLICY "Users can update their own broadcast lists"
ON public.broadcast_lists FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own broadcast lists" ON public.broadcast_lists;
CREATE POLICY "Users can delete their own broadcast lists"
ON public.broadcast_lists FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- BROADCAST_LIST_CONTACTS: INSERT + DELETE + SELECT (via join to broadcast_lists)
-- =============================================
DROP POLICY IF EXISTS "Users can add contacts to their lists" ON public.broadcast_list_contacts;
CREATE POLICY "Users can add contacts to their lists"
ON public.broadcast_list_contacts FOR INSERT TO public
WITH CHECK (EXISTS (
  SELECT 1 FROM broadcast_lists
  WHERE broadcast_lists.id = broadcast_list_contacts.list_id
  AND (broadcast_lists.user_id = auth.uid() OR broadcast_lists.user_id IN (SELECT get_organization_member_ids(auth.uid())))
));

DROP POLICY IF EXISTS "Users can remove contacts from their lists" ON public.broadcast_list_contacts;
CREATE POLICY "Users can remove contacts from their lists"
ON public.broadcast_list_contacts FOR DELETE TO public
USING (EXISTS (
  SELECT 1 FROM broadcast_lists
  WHERE broadcast_lists.id = broadcast_list_contacts.list_id
  AND (broadcast_lists.user_id = auth.uid() OR broadcast_lists.user_id IN (SELECT get_organization_member_ids(auth.uid())))
));

DROP POLICY IF EXISTS "Users can view contacts in their lists" ON public.broadcast_list_contacts;
CREATE POLICY "Users can view contacts in their lists"
ON public.broadcast_list_contacts FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM broadcast_lists
  WHERE broadcast_lists.id = broadcast_list_contacts.list_id
  AND (broadcast_lists.user_id = auth.uid() OR broadcast_lists.user_id IN (SELECT get_organization_member_ids(auth.uid())))
));

-- =============================================
-- BROADCAST_SENDS: SELECT + UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can view their own broadcast sends" ON public.broadcast_sends;
CREATE POLICY "Users can view their own broadcast sends"
ON public.broadcast_sends FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own broadcast sends" ON public.broadcast_sends;
CREATE POLICY "Users can update their own broadcast sends"
ON public.broadcast_sends FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own broadcast sends" ON public.broadcast_sends;
CREATE POLICY "Users can delete their own broadcast sends"
ON public.broadcast_sends FOR DELETE TO authenticated
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- TAGS: UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can update their own tags" ON public.tags;
CREATE POLICY "Users can update their own tags"
ON public.tags FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own tags" ON public.tags;
CREATE POLICY "Users can delete their own tags"
ON public.tags FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- CONVERSATION_TAGS: UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can update their own conversation tags" ON public.conversation_tags;
CREATE POLICY "Users can update their own conversation tags"
ON public.conversation_tags FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own conversation tags" ON public.conversation_tags;
CREATE POLICY "Users can delete their own conversation tags"
ON public.conversation_tags FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- CONVERSATION_TAG_ASSIGNMENTS: INSERT + DELETE + SELECT (via conversations)
-- =============================================
DROP POLICY IF EXISTS "Users can create their conversation tag assignments" ON public.conversation_tag_assignments;
CREATE POLICY "Users can create their conversation tag assignments"
ON public.conversation_tag_assignments FOR INSERT TO public
WITH CHECK (EXISTS (
  SELECT 1 FROM conversations
  WHERE conversations.id = conversation_tag_assignments.conversation_id
  AND (conversations.user_id = auth.uid() OR conversations.user_id IN (SELECT get_organization_member_ids(auth.uid())))
));

DROP POLICY IF EXISTS "Users can delete their conversation tag assignments" ON public.conversation_tag_assignments;
CREATE POLICY "Users can delete their conversation tag assignments"
ON public.conversation_tag_assignments FOR DELETE TO public
USING (EXISTS (
  SELECT 1 FROM conversations
  WHERE conversations.id = conversation_tag_assignments.conversation_id
  AND (conversations.user_id = auth.uid() OR conversations.user_id IN (SELECT get_organization_member_ids(auth.uid())))
));

DROP POLICY IF EXISTS "Users can view their conversation tag assignments" ON public.conversation_tag_assignments;
CREATE POLICY "Users can view their conversation tag assignments"
ON public.conversation_tag_assignments FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM conversations
  WHERE conversations.id = conversation_tag_assignments.conversation_id
  AND (conversations.user_id = auth.uid() OR conversations.user_id IN (SELECT get_organization_member_ids(auth.uid())))
));

-- =============================================
-- CONVERSATION_NOTES: UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can update their own notes" ON public.conversation_notes;
CREATE POLICY "Users can update their own notes"
ON public.conversation_notes FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own notes" ON public.conversation_notes;
CREATE POLICY "Users can delete their own notes"
ON public.conversation_notes FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- CONVERSATION_STAGE_DATA: INSERT + UPDATE + SELECT (via conversations)
-- =============================================
DROP POLICY IF EXISTS "Users can create their conversation stage data" ON public.conversation_stage_data;
CREATE POLICY "Users can create their conversation stage data"
ON public.conversation_stage_data FOR INSERT TO public
WITH CHECK (EXISTS (
  SELECT 1 FROM conversations
  WHERE conversations.id = conversation_stage_data.conversation_id
  AND (conversations.user_id = auth.uid() OR conversations.user_id IN (SELECT get_organization_member_ids(auth.uid())))
));

DROP POLICY IF EXISTS "Users can update their conversation stage data" ON public.conversation_stage_data;
CREATE POLICY "Users can update their conversation stage data"
ON public.conversation_stage_data FOR UPDATE TO public
USING (EXISTS (
  SELECT 1 FROM conversations
  WHERE conversations.id = conversation_stage_data.conversation_id
  AND (conversations.user_id = auth.uid() OR conversations.user_id IN (SELECT get_organization_member_ids(auth.uid())))
));

DROP POLICY IF EXISTS "Users can view their conversation stage data" ON public.conversation_stage_data;
CREATE POLICY "Users can view their conversation stage data"
ON public.conversation_stage_data FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM conversations
  WHERE conversations.id = conversation_stage_data.conversation_id
  AND (conversations.user_id = auth.uid() OR conversations.user_id IN (SELECT get_organization_member_ids(auth.uid())))
));

-- =============================================
-- CUSTOM_FIELD_DEFINITIONS: UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can update their own field definitions" ON public.custom_field_definitions;
CREATE POLICY "Users can update their own field definitions"
ON public.custom_field_definitions FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own field definitions" ON public.custom_field_definitions;
CREATE POLICY "Users can delete their own field definitions"
ON public.custom_field_definitions FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- FUNNELS: UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can update their own funnels" ON public.funnels;
CREATE POLICY "Users can update their own funnels"
ON public.funnels FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own funnels" ON public.funnels;
CREATE POLICY "Users can delete their own funnels"
ON public.funnels FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- CHATBOT_FLOWS: UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can update their own flows" ON public.chatbot_flows;
CREATE POLICY "Users can update their own flows"
ON public.chatbot_flows FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own flows" ON public.chatbot_flows;
CREATE POLICY "Users can delete their own flows"
ON public.chatbot_flows FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- CHATBOT_FLOW_NODES: UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can update their own nodes" ON public.chatbot_flow_nodes;
CREATE POLICY "Users can update their own nodes"
ON public.chatbot_flow_nodes FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own nodes" ON public.chatbot_flow_nodes;
CREATE POLICY "Users can delete their own nodes"
ON public.chatbot_flow_nodes FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- CHATBOT_FLOW_EDGES: UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can update their own edges" ON public.chatbot_flow_edges;
CREATE POLICY "Users can update their own edges"
ON public.chatbot_flow_edges FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own edges" ON public.chatbot_flow_edges;
CREATE POLICY "Users can delete their own edges"
ON public.chatbot_flow_edges FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- CHATBOT_EXECUTIONS: DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can delete their own executions" ON public.chatbot_executions;
CREATE POLICY "Users can delete their own executions"
ON public.chatbot_executions FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- INBOX_MESSAGES: UPDATE
-- =============================================
DROP POLICY IF EXISTS "Users can update their own messages" ON public.inbox_messages;
CREATE POLICY "Users can update their own messages"
ON public.inbox_messages FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- META_TEMPLATES: SELECT + UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can view their own meta templates" ON public.meta_templates;
CREATE POLICY "Users can view their own meta templates"
ON public.meta_templates FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own meta templates" ON public.meta_templates;
CREATE POLICY "Users can update their own meta templates"
ON public.meta_templates FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own meta templates" ON public.meta_templates;
CREATE POLICY "Users can delete their own meta templates"
ON public.meta_templates FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- META_WHATSAPP_NUMBERS: UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can update their own meta numbers" ON public.meta_whatsapp_numbers;
CREATE POLICY "Users can update their own meta numbers"
ON public.meta_whatsapp_numbers FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own meta numbers" ON public.meta_whatsapp_numbers;
CREATE POLICY "Users can delete their own meta numbers"
ON public.meta_whatsapp_numbers FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- TEMPLATE_VARIATIONS: ALL (via message_templates join)
-- =============================================
DROP POLICY IF EXISTS "Users can view their template variations" ON public.template_variations;
CREATE POLICY "Users can view their template variations"
ON public.template_variations FOR SELECT TO public
USING (template_id IN (
  SELECT id FROM message_templates
  WHERE user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
));

DROP POLICY IF EXISTS "Users can insert variations for their templates" ON public.template_variations;
CREATE POLICY "Users can insert variations for their templates"
ON public.template_variations FOR INSERT TO public
WITH CHECK (template_id IN (
  SELECT id FROM message_templates
  WHERE user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
));

DROP POLICY IF EXISTS "Users can update their template variations" ON public.template_variations;
CREATE POLICY "Users can update their template variations"
ON public.template_variations FOR UPDATE TO public
USING (template_id IN (
  SELECT id FROM message_templates
  WHERE user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
));

DROP POLICY IF EXISTS "Users can delete their template variations" ON public.template_variations;
CREATE POLICY "Users can delete their template variations"
ON public.template_variations FOR DELETE TO public
USING (template_id IN (
  SELECT id FROM message_templates
  WHERE user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
));

-- =============================================
-- TASK_TYPES: UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can update their own task types" ON public.task_types;
CREATE POLICY "Users can update their own task types"
ON public.task_types FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own task types" ON public.task_types;
CREATE POLICY "Users can delete their own task types"
ON public.task_types FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- AI_AGENT_STAGES: ALL operations
-- =============================================
DROP POLICY IF EXISTS "Users can view their own stages" ON public.ai_agent_stages;
CREATE POLICY "Users can view their own stages"
ON public.ai_agent_stages FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own stages" ON public.ai_agent_stages;
CREATE POLICY "Users can update their own stages"
ON public.ai_agent_stages FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own stages" ON public.ai_agent_stages;
CREATE POLICY "Users can delete their own stages"
ON public.ai_agent_stages FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- AI_AGENT_VARIABLES: ALL operations
-- =============================================
DROP POLICY IF EXISTS "Users can view their own variables" ON public.ai_agent_variables;
CREATE POLICY "Users can view their own variables"
ON public.ai_agent_variables FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own variables" ON public.ai_agent_variables;
CREATE POLICY "Users can update their own variables"
ON public.ai_agent_variables FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own variables" ON public.ai_agent_variables;
CREATE POLICY "Users can delete their own variables"
ON public.ai_agent_variables FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- AI_AGENT_INTEGRATIONS: ALL
-- =============================================
DROP POLICY IF EXISTS "Users can manage their agent integrations" ON public.ai_agent_integrations;
CREATE POLICY "Users can manage their agent integrations"
ON public.ai_agent_integrations FOR ALL TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())))
WITH CHECK (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- AI_AGENT_WEBHOOK_LOGS: SELECT
-- =============================================
DROP POLICY IF EXISTS "Users can view their webhook logs" ON public.ai_agent_webhook_logs;
CREATE POLICY "Users can view their webhook logs"
ON public.ai_agent_webhook_logs FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- INSTAGRAM_SCRAPE_RESULTS: UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can update their own scrape results" ON public.instagram_scrape_results;
CREATE POLICY "Users can update their own scrape results"
ON public.instagram_scrape_results FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own scrape results" ON public.instagram_scrape_results;
CREATE POLICY "Users can delete their own scrape results"
ON public.instagram_scrape_results FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- CAMPAIGNS: UPDATE (fix the user_id-only policy, keep org admin one)
-- =============================================
DROP POLICY IF EXISTS "Users can update their own campaigns" ON public.campaigns;
CREATE POLICY "Users can update their own campaigns"
ON public.campaigns FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- WARMING_SCHEDULES: UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can update their own warming schedules" ON public.warming_schedules;
CREATE POLICY "Users can update their own warming schedules"
ON public.warming_schedules FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own warming schedules" ON public.warming_schedules;
CREATE POLICY "Users can delete their own warming schedules"
ON public.warming_schedules FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- WARMING_CONTENT: SELECT + UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can view their own warming content" ON public.warming_content;
CREATE POLICY "Users can view their own warming content"
ON public.warming_content FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own warming content" ON public.warming_content;
CREATE POLICY "Users can update their own warming content"
ON public.warming_content FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own warming content" ON public.warming_content;
CREATE POLICY "Users can delete their own warming content"
ON public.warming_content FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- WARMING_PAIRS: SELECT + UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can view their own warming pairs" ON public.warming_pairs;
CREATE POLICY "Users can view their own warming pairs"
ON public.warming_pairs FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own warming pairs" ON public.warming_pairs;
CREATE POLICY "Users can update their own warming pairs"
ON public.warming_pairs FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own warming pairs" ON public.warming_pairs;
CREATE POLICY "Users can delete their own warming pairs"
ON public.warming_pairs FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- BILLING_REMINDERS: SELECT + UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can view their own billing reminders" ON public.billing_reminders;
CREATE POLICY "Users can view their own billing reminders"
ON public.billing_reminders FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own billing reminders" ON public.billing_reminders;
CREATE POLICY "Users can update their own billing reminders"
ON public.billing_reminders FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own billing reminders" ON public.billing_reminders;
CREATE POLICY "Users can delete their own billing reminders"
ON public.billing_reminders FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- CALENDLY_EVENTS: SELECT + UPDATE
-- =============================================
DROP POLICY IF EXISTS "Users can view their own events" ON public.calendly_events;
CREATE POLICY "Users can view their own events"
ON public.calendly_events FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own events" ON public.calendly_events;
CREATE POLICY "Users can update their own events"
ON public.calendly_events FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- VOIP_CONFIGURATIONS: SELECT + UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can view their own voip configs" ON public.voip_configurations;
CREATE POLICY "Users can view their own voip configs"
ON public.voip_configurations FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own voip configs" ON public.voip_configurations;
CREATE POLICY "Users can update their own voip configs"
ON public.voip_configurations FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own voip configs" ON public.voip_configurations;
CREATE POLICY "Users can delete their own voip configs"
ON public.voip_configurations FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- VOIP_LINES: SELECT + UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can view their own voip lines" ON public.voip_lines;
CREATE POLICY "Users can view their own voip lines"
ON public.voip_lines FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own voip lines" ON public.voip_lines;
CREATE POLICY "Users can update their own voip lines"
ON public.voip_lines FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own voip lines" ON public.voip_lines;
CREATE POLICY "Users can delete their own voip lines"
ON public.voip_lines FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- ELEVENLABS_SIP_CONFIG: SELECT + UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can view their own SIP config" ON public.elevenlabs_sip_config;
CREATE POLICY "Users can view their own SIP config"
ON public.elevenlabs_sip_config FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own SIP config" ON public.elevenlabs_sip_config;
CREATE POLICY "Users can update their own SIP config"
ON public.elevenlabs_sip_config FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own SIP config" ON public.elevenlabs_sip_config;
CREATE POLICY "Users can delete their own SIP config"
ON public.elevenlabs_sip_config FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- AI_PHONE_CALLS: SELECT + UPDATE
-- =============================================
DROP POLICY IF EXISTS "Users can view their own AI calls" ON public.ai_phone_calls;
CREATE POLICY "Users can view their own AI calls"
ON public.ai_phone_calls FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own AI calls" ON public.ai_phone_calls;
CREATE POLICY "Users can update their own AI calls"
ON public.ai_phone_calls FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- INTEGRATIONS: SELECT + UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can view their own integrations" ON public.integrations;
CREATE POLICY "Users can view their own integrations"
ON public.integrations FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own integrations" ON public.integrations;
CREATE POLICY "Users can update their own integrations"
ON public.integrations FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own integrations" ON public.integrations;
CREATE POLICY "Users can delete their own integrations"
ON public.integrations FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- EXTENSIONS: SELECT + UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can view their own extensions" ON public.extensions;
CREATE POLICY "Users can view their own extensions"
ON public.extensions FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own extensions" ON public.extensions;
CREATE POLICY "Users can update their own extensions"
ON public.extensions FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own extensions" ON public.extensions;
CREATE POLICY "Users can delete their own extensions"
ON public.extensions FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- SCRAPED_LEADS: SELECT + UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can view their own scraped leads" ON public.scraped_leads;
CREATE POLICY "Users can view their own scraped leads"
ON public.scraped_leads FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own scraped leads" ON public.scraped_leads;
CREATE POLICY "Users can update their own scraped leads"
ON public.scraped_leads FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own scraped leads" ON public.scraped_leads;
CREATE POLICY "Users can delete their own scraped leads"
ON public.scraped_leads FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- INSTAGRAM_COMMENTS: SELECT + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can view their own comments" ON public.instagram_comments;
CREATE POLICY "Users can view their own comments"
ON public.instagram_comments FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.instagram_comments;
CREATE POLICY "Users can delete their own comments"
ON public.instagram_comments FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- CALENDAR_INTEGRATIONS: SELECT + UPDATE + DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can view their own integrations" ON public.calendar_integrations;
CREATE POLICY "Users can view their own integrations"
ON public.calendar_integrations FOR SELECT TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own integrations" ON public.calendar_integrations;
CREATE POLICY "Users can update their own integrations"
ON public.calendar_integrations FOR UPDATE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own integrations" ON public.calendar_integrations;
CREATE POLICY "Users can delete their own integrations"
ON public.calendar_integrations FOR DELETE TO public
USING (auth.uid() = user_id OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- WEBHOOK_CONNECTIONS: ALL
-- =============================================
DROP POLICY IF EXISTS "Users manage own webhook_connections" ON public.webhook_connections;
CREATE POLICY "Users manage own webhook_connections"
ON public.webhook_connections FOR ALL TO authenticated
USING (user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid())))
WITH CHECK (user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- =============================================
-- WEBHOOK_LOGS: SELECT
-- =============================================
DROP POLICY IF EXISTS "Users view own webhook_logs" ON public.webhook_logs;
CREATE POLICY "Users view own webhook_logs"
ON public.webhook_logs FOR SELECT TO authenticated
USING (user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid())));
