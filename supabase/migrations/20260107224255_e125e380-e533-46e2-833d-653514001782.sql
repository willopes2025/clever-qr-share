-- Adicionar novas colunas para suportar scraping de seguidores/seguidos
ALTER TABLE instagram_scrape_results ADD COLUMN IF NOT EXISTS source_username TEXT;
ALTER TABLE instagram_scrape_results ADD COLUMN IF NOT EXISTS scrape_type TEXT DEFAULT 'profile';

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_instagram_scrape_results_source ON instagram_scrape_results(source_username);
CREATE INDEX IF NOT EXISTS idx_instagram_scrape_results_type ON instagram_scrape_results(scrape_type);