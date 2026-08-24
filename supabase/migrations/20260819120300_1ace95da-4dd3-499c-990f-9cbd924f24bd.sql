-- Fase 0 (Public API): soft delete em deals (leads do funil).
-- Mesma semantica de contatos: API filtra deleted_at IS NULL; app atual inalterado.

ALTER TABLE public.funnel_deals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_funnel_deals_deleted_at ON public.funnel_deals(deleted_at);

-- Rollback: ALTER TABLE public.funnel_deals DROP COLUMN IF EXISTS deleted_at;
