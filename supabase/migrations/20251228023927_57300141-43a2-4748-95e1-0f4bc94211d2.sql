-- Adicionar novos gatilhos ao enum funnel_trigger_type
ALTER TYPE funnel_trigger_type ADD VALUE IF NOT EXISTS 'on_message_received';
ALTER TYPE funnel_trigger_type ADD VALUE IF NOT EXISTS 'on_keyword_received';
ALTER TYPE funnel_trigger_type ADD VALUE IF NOT EXISTS 'on_contact_created';
ALTER TYPE funnel_trigger_type ADD VALUE IF NOT EXISTS 'on_tag_added';
ALTER TYPE funnel_trigger_type ADD VALUE IF NOT EXISTS 'on_tag_removed';
ALTER TYPE funnel_trigger_type ADD VALUE IF NOT EXISTS 'on_inactivity';
ALTER TYPE funnel_trigger_type ADD VALUE IF NOT EXISTS 'on_deal_value_changed';
ALTER TYPE funnel_trigger_type ADD VALUE IF NOT EXISTS 'on_custom_field_changed';

-- Adicionar novas ações ao enum funnel_action_type
ALTER TYPE funnel_action_type ADD VALUE IF NOT EXISTS 'trigger_chatbot_flow';
ALTER TYPE funnel_action_type ADD VALUE IF NOT EXISTS 'set_custom_field';
ALTER TYPE funnel_action_type ADD VALUE IF NOT EXISTS 'set_deal_value';
ALTER TYPE funnel_action_type ADD VALUE IF NOT EXISTS 'change_responsible';
ALTER TYPE funnel_action_type ADD VALUE IF NOT EXISTS 'add_note';
ALTER TYPE funnel_action_type ADD VALUE IF NOT EXISTS 'webhook_request';
ALTER TYPE funnel_action_type ADD VALUE IF NOT EXISTS 'create_task';
ALTER TYPE funnel_action_type ADD VALUE IF NOT EXISTS 'close_deal_won';
ALTER TYPE funnel_action_type ADD VALUE IF NOT EXISTS 'close_deal_lost';