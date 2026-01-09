-- Add columns for chip device and whatsapp device separation
ALTER TABLE whatsapp_instances 
ADD COLUMN IF NOT EXISTS chip_device TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_device TEXT;

-- Add comment for documentation
COMMENT ON COLUMN whatsapp_instances.chip_device IS 'Device where the physical SIM chip is located';
COMMENT ON COLUMN whatsapp_instances.whatsapp_device IS 'Device where WhatsApp app is running (can be different via linked devices)';