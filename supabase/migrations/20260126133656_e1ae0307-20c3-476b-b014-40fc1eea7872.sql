-- Add entity_type column to custom_field_definitions to distinguish between contact and lead fields
ALTER TABLE public.custom_field_definitions 
ADD COLUMN entity_type text NOT NULL DEFAULT 'contact' 
CHECK (entity_type IN ('contact', 'lead'));

-- Add comment for clarity
COMMENT ON COLUMN public.custom_field_definitions.entity_type IS 'Defines whether this field belongs to a contact or a lead/deal';