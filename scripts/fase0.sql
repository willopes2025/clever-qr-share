-- Fase 0: Aplicar todas as migrations da API pública de uma vez
-- Executa no banco de homologação via: supabase db query --linked -f scripts/fase0.sql

-- 1. api_keys
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_organization_id ON public.api_keys(organization_id);

-- 2. api_rate_limit
CREATE TABLE IF NOT EXISTS public.api_rate_limit (
  key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  bucket_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (key_id, bucket_start)
);

ALTER TABLE public.api_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_rate_limit_bucket ON public.api_rate_limit(bucket_start);

-- 3. contacts: soft delete
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON public.contacts(deleted_at);

-- 4. funnel_deals: soft delete
ALTER TABLE public.funnel_deals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_funnel_deals_deleted_at ON public.funnel_deals(deleted_at);
