-- Create scraped_leads table for storing leads from CNPJ.ws
CREATE TABLE public.scraped_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cnpj TEXT NOT NULL,
  razao_social TEXT,
  nome_fantasia TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  cep TEXT,
  cnae_code TEXT,
  cnae_description TEXT,
  porte TEXT,
  situacao_cadastral TEXT,
  capital_social NUMERIC,
  data_abertura DATE,
  source TEXT DEFAULT 'cnpjws',
  raw_data JSONB,
  imported_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, cnpj)
);

-- Enable RLS
ALTER TABLE public.scraped_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own scraped leads"
ON public.scraped_leads FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scraped leads"
ON public.scraped_leads FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scraped leads"
ON public.scraped_leads FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scraped leads"
ON public.scraped_leads FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_scraped_leads_user_id ON public.scraped_leads(user_id);
CREATE INDEX idx_scraped_leads_cnpj ON public.scraped_leads(cnpj);
CREATE INDEX idx_scraped_leads_state_city ON public.scraped_leads(state, city);