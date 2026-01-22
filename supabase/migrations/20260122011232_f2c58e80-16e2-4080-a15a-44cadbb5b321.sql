-- Atualizar política de UPDATE para permitir membros da organização
DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
CREATE POLICY "Users can update organization conversations" 
ON conversations FOR UPDATE 
USING (
  user_id = auth.uid() 
  OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
);

-- Atualizar política de DELETE para permitir membros da organização
DROP POLICY IF EXISTS "Users can delete their own conversations" ON conversations;
CREATE POLICY "Users can delete organization conversations" 
ON conversations FOR DELETE 
USING (
  user_id = auth.uid() 
  OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
);