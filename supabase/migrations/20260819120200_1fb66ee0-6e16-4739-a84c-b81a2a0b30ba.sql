-- Fase 0 (Public API): soft delete em contatos.
-- A API filtra 'deleted_at IS NULL'; o app atual NAO filtra, mas como a coluna
-- entra NULL para todos os registros existentes, o comportamento de hoje nao muda.

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON public.contacts(deleted_at);

-- Rollback: ALTER TABLE public.contacts DROP COLUMN IF EXISTS deleted_at;
