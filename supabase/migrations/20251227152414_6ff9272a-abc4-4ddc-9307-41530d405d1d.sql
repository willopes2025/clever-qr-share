-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update their own templates" ON public.message_templates;

-- Create new UPDATE policy that allows organization members to update templates
CREATE POLICY "Users can update organization templates" 
ON public.message_templates 
FOR UPDATE 
USING ((user_id = auth.uid()) OR (user_id IN (SELECT get_organization_member_ids(auth.uid()))));

-- Also update DELETE policy to allow organization members to delete templates
DROP POLICY IF EXISTS "Users can delete their own templates" ON public.message_templates;

CREATE POLICY "Users can delete organization templates" 
ON public.message_templates 
FOR DELETE 
USING ((user_id = auth.uid()) OR (user_id IN (SELECT get_organization_member_ids(auth.uid()))));