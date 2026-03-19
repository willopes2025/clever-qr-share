
-- Adicionar campos para suporte completo à API da Meta
ALTER TABLE public.meta_whatsapp_numbers
  ADD COLUMN IF NOT EXISTS waba_id text,
  ADD COLUMN IF NOT EXISTS business_account_id text,
  ADD COLUMN IF NOT EXISTS quality_rating text,
  ADD COLUMN IF NOT EXISTS messaging_limit text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'connected',
  ADD COLUMN IF NOT EXISTS connected_at timestamp with time zone;

-- Adicionar unique constraint no phone_number_id individualmente (além do composite existente)
-- para garantir que nenhum phone_number_id seja duplicado globalmente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'meta_whatsapp_numbers_phone_number_id_unique'
  ) THEN
    ALTER TABLE public.meta_whatsapp_numbers
      ADD CONSTRAINT meta_whatsapp_numbers_phone_number_id_unique UNIQUE (phone_number_id);
  END IF;
END $$;
