-- Drop existing delete policy
DROP POLICY IF EXISTS "Users can delete their own contacts" ON contacts;

-- Create new delete policy that allows organization members to delete contacts
CREATE POLICY "Users can delete organization contacts"
  ON contacts
  FOR DELETE
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
  );

-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;

-- Create new update policy that allows organization members to update contacts
CREATE POLICY "Users can update organization contacts"
  ON contacts
  FOR UPDATE
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
  );