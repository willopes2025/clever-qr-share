ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

UPDATE public.organizations o
SET timezone = COALESCE(us.timezone, 'America/Sao_Paulo')
FROM public.user_settings us
WHERE us.user_id = o.owner_id
  AND us.timezone IS NOT NULL
  AND us.timezone <> ''
  AND o.timezone = 'America/Sao_Paulo';