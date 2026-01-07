-- Adicionar coluna is_private para marcar perfis privados
ALTER TABLE instagram_scrape_results ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;