-- Add column to store tag that will be applied to contacts on successful delivery
ALTER TABLE campaigns
ADD COLUMN tag_on_delivery_id uuid REFERENCES tags(id) ON DELETE SET NULL;