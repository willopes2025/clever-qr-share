ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS date_format text NOT NULL DEFAULT 'DD/MM/YYYY',
  ADD COLUMN IF NOT EXISTS time_format text NOT NULL DEFAULT '24h';

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_date_format_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_date_format_check
  CHECK (date_format IN ('DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD'));

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_time_format_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_time_format_check
  CHECK (time_format IN ('24h','12h'));

UPDATE public.organizations
  SET date_format = 'DD/MM/YYYY', time_format = '24h'
  WHERE date_format IS NULL OR time_format IS NULL;