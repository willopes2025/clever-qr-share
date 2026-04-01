
-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own meta numbers" ON meta_whatsapp_numbers;

-- Create new SELECT policy that allows org members to see numbers from their organization
CREATE POLICY "Users can view org meta numbers"
ON meta_whatsapp_numbers
FOR SELECT
TO authenticated
USING (
  user_id IN (SELECT get_organization_member_ids(auth.uid()))
);
