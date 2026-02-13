ALTER TABLE public.form_fields DROP CONSTRAINT form_fields_mapping_type_check;

ALTER TABLE public.form_fields ADD CONSTRAINT form_fields_mapping_type_check CHECK (mapping_type = ANY (ARRAY['contact_field'::text, 'custom_field'::text, 'new_custom_field'::text, 'lead_field'::text, 'new_lead_field'::text]));