-- Add asaas_payment_status column to contacts for tracking payment status
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS asaas_payment_status text;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_contacts_asaas_payment_status ON public.contacts(asaas_payment_status) WHERE asaas_payment_status IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.contacts.asaas_payment_status IS 'Status de pagamento Asaas: overdue, pending, current, null';