
-- Fix contact_tags RLS policies to support organization-wide access

DROP POLICY IF EXISTS "Users can view tags for their contacts" ON public.contact_tags;
CREATE POLICY "Users can view tags for their contacts"
ON public.contact_tags FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM contacts
    WHERE contacts.id = contact_tags.contact_id
    AND (contacts.user_id = auth.uid() OR contacts.user_id IN (SELECT get_organization_member_ids(auth.uid())))
  )
);

DROP POLICY IF EXISTS "Users can add tags to their contacts" ON public.contact_tags;
CREATE POLICY "Users can add tags to their contacts"
ON public.contact_tags FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM contacts
    WHERE contacts.id = contact_tags.contact_id
    AND (contacts.user_id = auth.uid() OR contacts.user_id IN (SELECT get_organization_member_ids(auth.uid())))
  )
);

DROP POLICY IF EXISTS "Users can remove tags from their contacts" ON public.contact_tags;
CREATE POLICY "Users can remove tags from their contacts"
ON public.contact_tags FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM contacts
    WHERE contacts.id = contact_tags.contact_id
    AND (contacts.user_id = auth.uid() OR contacts.user_id IN (SELECT get_organization_member_ids(auth.uid())))
  )
);
