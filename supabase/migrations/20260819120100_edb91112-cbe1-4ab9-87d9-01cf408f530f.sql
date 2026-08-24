-- Fase 0 (Public API): controle de rate limit (janela fixa de 1 segundo, 5 req/s por key)
-- bucket_start = date_trunc('second', now()). A lógica de enforcement (Fase 1) incrementa
-- request_count no segundo atual e bloqueia com 429 quando > 5.
-- Autolimpeza: o enforcement também apaga buckets antigos (bucket_start < now() - '1 minute')
-- antes de contar, evitando crescimento infinito SEM depender de pg_cron.

CREATE TABLE public.api_rate_limit (
  key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  bucket_start TIMESTAMPTZ NOT NULL,        -- inicio do segundo (date_trunc('second', now()))
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (key_id, bucket_start)
);

ALTER TABLE public.api_rate_limit ENABLE ROW LEVEL SECURITY;
-- Sem policies: apenas service_role (edge function) acessa.

CREATE INDEX idx_api_rate_limit_bucket ON public.api_rate_limit(bucket_start);

-- Rollback: DROP TABLE public.api_rate_limit;
