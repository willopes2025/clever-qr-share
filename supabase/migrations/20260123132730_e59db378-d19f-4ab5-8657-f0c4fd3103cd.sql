-- Adicionar coluna retry_at para campanhas que precisam aguardar horário permitido
-- Isso evita o loop de chunking excessivo para delays longos

ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS retry_at TIMESTAMP WITH TIME ZONE;

-- Criar índice para facilitar busca de campanhas que precisam ser retomadas
CREATE INDEX IF NOT EXISTS idx_campaigns_retry_at 
ON public.campaigns(retry_at) 
WHERE retry_at IS NOT NULL AND status = 'sending';

COMMENT ON COLUMN public.campaigns.retry_at IS 'Timestamp para retry automático de campanhas aguardando horário permitido';