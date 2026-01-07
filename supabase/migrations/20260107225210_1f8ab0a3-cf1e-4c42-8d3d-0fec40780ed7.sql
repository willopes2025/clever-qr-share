-- Adicionar coluna enriched_at para rastrear perfis enriquecidos
ALTER TABLE instagram_scrape_results 
ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP WITH TIME ZONE;