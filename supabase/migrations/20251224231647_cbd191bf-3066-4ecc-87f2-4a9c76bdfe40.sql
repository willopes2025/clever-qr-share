-- Permitir DELETE em organizations para o owner
CREATE POLICY "Owners can delete their organization"
ON public.organizations
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- Remover e recriar constraint com CASCADE
ALTER TABLE public.team_members
DROP CONSTRAINT IF EXISTS team_members_organization_id_fkey;

ALTER TABLE public.team_members
ADD CONSTRAINT team_members_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES public.organizations(id)
  ON DELETE CASCADE;