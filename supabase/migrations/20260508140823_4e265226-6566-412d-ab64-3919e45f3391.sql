
-- 1. team_groups: perfis salvos
CREATE TABLE public.team_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX idx_team_groups_org ON public.team_groups(organization_id);

CREATE TRIGGER update_team_groups_updated_at
  BEFORE UPDATE ON public.team_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.team_groups ENABLE ROW LEVEL SECURITY;

-- SELECT: members of the org can see groups
CREATE POLICY "Org members can view team groups"
  ON public.team_groups FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

-- INSERT/UPDATE/DELETE: only owner of the organization
CREATE POLICY "Owner can insert team groups"
  ON public.team_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.owner_id = auth.uid())
  );

CREATE POLICY "Owner can update team groups"
  ON public.team_groups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.owner_id = auth.uid())
  );

CREATE POLICY "Owner can delete team groups"
  ON public.team_groups FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.owner_id = auth.uid())
  );

-- 2. team_group_instances
CREATE TABLE public.team_group_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_group_id uuid NOT NULL REFERENCES public.team_groups(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_group_id, instance_id)
);

CREATE INDEX idx_team_group_instances_group ON public.team_group_instances(team_group_id);

ALTER TABLE public.team_group_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view team group instances"
  ON public.team_group_instances FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_groups tg
    WHERE tg.id = team_group_id AND public.user_belongs_to_org(auth.uid(), tg.organization_id)
  ));

CREATE POLICY "Owner can manage team group instances"
  ON public.team_group_instances FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_groups tg
    JOIN public.organizations o ON o.id = tg.organization_id
    WHERE tg.id = team_group_id AND o.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.team_groups tg
    JOIN public.organizations o ON o.id = tg.organization_id
    WHERE tg.id = team_group_id AND o.owner_id = auth.uid()
  ));

-- 3. team_group_meta_numbers
CREATE TABLE public.team_group_meta_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_group_id uuid NOT NULL REFERENCES public.team_groups(id) ON DELETE CASCADE,
  meta_number_id uuid NOT NULL REFERENCES public.meta_whatsapp_numbers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_group_id, meta_number_id)
);

CREATE INDEX idx_team_group_meta_numbers_group ON public.team_group_meta_numbers(team_group_id);

ALTER TABLE public.team_group_meta_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view team group meta numbers"
  ON public.team_group_meta_numbers FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_groups tg
    WHERE tg.id = team_group_id AND public.user_belongs_to_org(auth.uid(), tg.organization_id)
  ));

CREATE POLICY "Owner can manage team group meta numbers"
  ON public.team_group_meta_numbers FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_groups tg
    JOIN public.organizations o ON o.id = tg.organization_id
    WHERE tg.id = team_group_id AND o.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.team_groups tg
    JOIN public.organizations o ON o.id = tg.organization_id
    WHERE tg.id = team_group_id AND o.owner_id = auth.uid()
  ));

-- 4. team_members.team_group_id
ALTER TABLE public.team_members
  ADD COLUMN team_group_id uuid REFERENCES public.team_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_team_members_team_group ON public.team_members(team_group_id);

-- 5. apply_team_group_to_member RPC
CREATE OR REPLACE FUNCTION public.apply_team_group_to_member(
  _member_id uuid,
  _group_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_group_org_id uuid;
  v_caller_is_owner boolean;
BEGIN
  -- Get org of the member
  SELECT organization_id INTO v_org_id FROM public.team_members WHERE id = _member_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- If group provided, ensure same org
  IF _group_id IS NOT NULL THEN
    SELECT organization_id INTO v_group_org_id FROM public.team_groups WHERE id = _group_id;
    IF v_group_org_id IS NULL OR v_group_org_id <> v_org_id THEN
      RAISE EXCEPTION 'Team group does not belong to this organization';
    END IF;
  END IF;

  -- Caller must be owner of the org
  SELECT EXISTS (
    SELECT 1 FROM public.organizations WHERE id = v_org_id AND owner_id = auth.uid()
  ) INTO v_caller_is_owner;

  IF NOT v_caller_is_owner THEN
    RAISE EXCEPTION 'Only the organization owner can apply team groups';
  END IF;

  IF _group_id IS NULL THEN
    -- Detach: clear group reference, leave permissions/instances/meta as-is
    UPDATE public.team_members SET team_group_id = NULL WHERE id = _member_id;
    RETURN;
  END IF;

  -- Copy permissions
  UPDATE public.team_members
  SET permissions = (SELECT permissions FROM public.team_groups WHERE id = _group_id),
      team_group_id = _group_id
  WHERE id = _member_id;

  -- Replace instances
  DELETE FROM public.team_member_instances WHERE team_member_id = _member_id;
  INSERT INTO public.team_member_instances (team_member_id, instance_id)
  SELECT _member_id, instance_id FROM public.team_group_instances WHERE team_group_id = _group_id;

  -- Replace meta numbers
  DELETE FROM public.team_member_meta_numbers WHERE team_member_id = _member_id;
  INSERT INTO public.team_member_meta_numbers (team_member_id, meta_number_id)
  SELECT _member_id, meta_number_id FROM public.team_group_meta_numbers WHERE team_group_id = _group_id;
END;
$$;

-- 6. resync_team_group_members RPC
CREATE OR REPLACE FUNCTION public.resync_team_group_members(_group_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_count integer := 0;
  v_member record;
BEGIN
  SELECT organization_id INTO v_org_id FROM public.team_groups WHERE id = _group_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Team group not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the organization owner can resync team groups';
  END IF;

  FOR v_member IN SELECT id FROM public.team_members WHERE team_group_id = _group_id LOOP
    PERFORM public.apply_team_group_to_member(v_member.id, _group_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
