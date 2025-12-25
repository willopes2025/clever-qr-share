-- Add columns to store selected event type for Calendly integration
ALTER TABLE calendar_integrations 
ADD COLUMN IF NOT EXISTS selected_event_type_uri TEXT,
ADD COLUMN IF NOT EXISTS selected_event_type_name TEXT,
ADD COLUMN IF NOT EXISTS selected_scheduling_url TEXT;