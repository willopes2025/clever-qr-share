-- 1. Adicionar coluna last_activity para tracking de heartbeat
ALTER TABLE public.user_activity_sessions 
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Fechar todas as sessões órfãs (abertas há mais de 24 horas)
UPDATE public.user_activity_sessions
SET 
  ended_at = started_at + INTERVAL '8 hours',
  duration_seconds = 28800
WHERE 
  ended_at IS NULL 
  AND started_at < NOW() - INTERVAL '24 hours';

-- 3. Criar função para auto-fechar sessões abandonadas (pode ser chamada via cron)
CREATE OR REPLACE FUNCTION public.close_abandoned_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  closed_count integer;
BEGIN
  UPDATE user_activity_sessions
  SET 
    ended_at = COALESCE(last_activity, started_at) + INTERVAL '30 minutes',
    duration_seconds = EXTRACT(EPOCH FROM (COALESCE(last_activity, started_at) + INTERVAL '30 minutes' - started_at))::integer
  WHERE 
    ended_at IS NULL 
    AND (
      -- Sessões sem atividade há mais de 12 horas
      (last_activity IS NOT NULL AND last_activity < NOW() - INTERVAL '12 hours')
      OR
      -- Sessões antigas sem last_activity
      (last_activity IS NULL AND started_at < NOW() - INTERVAL '12 hours')
    );
  
  GET DIAGNOSTICS closed_count = ROW_COUNT;
  RETURN closed_count;
END;
$$;

-- 4. Criar índice para melhorar performance de queries de sessões abertas
CREATE INDEX IF NOT EXISTS idx_activity_sessions_open 
ON public.user_activity_sessions (user_id, ended_at) 
WHERE ended_at IS NULL;