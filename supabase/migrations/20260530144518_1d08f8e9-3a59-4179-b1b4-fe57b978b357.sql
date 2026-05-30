
DELETE FROM public.team_member_instances
WHERE team_member_id IN (
  SELECT tm.id FROM public.team_members tm
  JOIN public.organizations o ON o.id = tm.organization_id
  WHERE tm.user_id = o.owner_id
);

DELETE FROM public.team_member_meta_numbers
WHERE team_member_id IN (
  SELECT tm.id FROM public.team_members tm
  JOIN public.organizations o ON o.id = tm.organization_id
  WHERE tm.user_id = o.owner_id
);
