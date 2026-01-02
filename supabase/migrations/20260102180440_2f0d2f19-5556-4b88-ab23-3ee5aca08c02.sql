-- Add duplicate control columns to campaigns table
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS skip_already_sent boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS skip_mode text DEFAULT 'same_template',
ADD COLUMN IF NOT EXISTS skip_days_period integer DEFAULT 30;

-- Add comment for documentation
COMMENT ON COLUMN campaigns.skip_already_sent IS 'If true, skip contacts that already received messages';
COMMENT ON COLUMN campaigns.skip_mode IS 'Criteria: same_campaign, same_template, same_list, any_campaign';
COMMENT ON COLUMN campaigns.skip_days_period IS 'Period in days to consider for duplicate check';