-- Add asaas_customer_id to contacts table
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS asaas_customer_id text;
CREATE INDEX IF NOT EXISTS idx_contacts_asaas ON public.contacts(asaas_customer_id) WHERE asaas_customer_id IS NOT NULL;