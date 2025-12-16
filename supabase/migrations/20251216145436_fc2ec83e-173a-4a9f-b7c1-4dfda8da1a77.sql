-- Add unique constraint for contact_id and tag_id combination
ALTER TABLE public.contact_tags 
ADD CONSTRAINT contact_tags_contact_tag_unique UNIQUE (contact_id, tag_id);