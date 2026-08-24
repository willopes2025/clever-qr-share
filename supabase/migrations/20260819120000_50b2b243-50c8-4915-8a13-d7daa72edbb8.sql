-- Fase 0 (Public API): tabela de API keys (credenciais de acesso externo)
-- Acesso: somente service_role (edge function 'public-api'). Sem policies para
-- anon/authenticated => RLS habilitado sem policy nega PostgREST direto.
-- Padrão coerente com meta_number_tokens (service-role only) já existente no projeto.

CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,            -- SHA-256 (hex) da api key; NUNCA texto puro
  key_prefix TEXT NOT NULL,                 -- ex.: 'wz_live_9f3a' para logs/diagnostico
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,                   -- NULL = sem expiracao
  revoked_at TIMESTAMPTZ                    -- NULL = ativa
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
-- Sem CREATE POLICY intencional: RLS habilitado sem policies => acesso negado
-- para anon/authenticated. Apenas service_role (edge function) acessa.

CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_organization_id ON public.api_keys(organization_id);

-- Rollback: DROP TABLE public.api_keys;
