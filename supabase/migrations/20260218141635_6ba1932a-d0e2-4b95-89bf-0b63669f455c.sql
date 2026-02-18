ALTER TABLE public.message_templates DROP CONSTRAINT message_templates_media_type_check;

ALTER TABLE public.message_templates ADD CONSTRAINT message_templates_media_type_check CHECK (media_type = ANY (ARRAY['image'::text, 'video'::text, 'audio'::text, 'document'::text]));