-- Add target funnel columns to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS target_funnel_id UUID REFERENCES funnels(id),
ADD COLUMN IF NOT EXISTS target_stage_id UUID REFERENCES funnel_stages(id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_target_funnel ON campaigns(target_funnel_id) WHERE target_funnel_id IS NOT NULL;