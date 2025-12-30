-- Add organization_id to whatsapp_instances
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_organization_id 
ON public.whatsapp_instances(organization_id);

-- Update existing instances to have organization_id based on user's organization
UPDATE public.whatsapp_instances wi
SET organization_id = tm.organization_id
FROM public.team_members tm
WHERE wi.user_id = tm.user_id
AND tm.status = 'active'
AND wi.organization_id IS NULL;

-- Also try from organizations where user is owner
UPDATE public.whatsapp_instances wi
SET organization_id = o.id
FROM public.organizations o
WHERE wi.user_id = o.owner_id
AND wi.organization_id IS NULL;