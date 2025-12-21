-- Add label_id column to contacts table to map WhatsApp Label IDs to real phone numbers
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS label_id text;

-- Create index for efficient lookups by label_id
CREATE INDEX IF NOT EXISTS idx_contacts_label_id ON public.contacts (label_id) WHERE label_id IS NOT NULL;