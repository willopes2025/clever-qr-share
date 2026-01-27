-- Add new trigger type for existing deals
ALTER TYPE funnel_trigger_type ADD VALUE IF NOT EXISTS 'on_existing_deals';

-- Add comment for documentation
COMMENT ON TYPE funnel_trigger_type IS 'Trigger types: on_stage_enter, on_stage_exit, on_deal_won, on_deal_lost, on_time_in_stage, on_funnel_enter, on_existing_deals (applies to all existing deals)';