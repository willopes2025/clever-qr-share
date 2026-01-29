-- Índice para buscas ILIKE no conteúdo (trigram)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_inbox_messages_content_trgm 
ON inbox_messages USING gin (content gin_trgm_ops);