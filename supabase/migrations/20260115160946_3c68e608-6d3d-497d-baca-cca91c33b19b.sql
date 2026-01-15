-- Tabela para armazenar instâncias no pool de aquecimento comunitário
CREATE TABLE public.warming_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_paired_at TIMESTAMPTZ,
  total_pairs_made INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(instance_id)
);

-- Índices para performance
CREATE INDEX idx_warming_pool_active ON warming_pool(is_active) WHERE is_active = true;
CREATE INDEX idx_warming_pool_user ON warming_pool(user_id);

-- RLS
ALTER TABLE warming_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pool entries" ON warming_pool
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pool entries" ON warming_pool
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pool entries" ON warming_pool
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pool entries" ON warming_pool
  FOR DELETE USING (auth.uid() = user_id);

-- Tabela para pareamentos do pool comunitário
CREATE TABLE public.warming_pool_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_entry_a_id UUID NOT NULL REFERENCES public.warming_pool(id) ON DELETE CASCADE,
  pool_entry_b_id UUID NOT NULL REFERENCES public.warming_pool(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  messages_exchanged INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  
  CONSTRAINT unique_pair CHECK (pool_entry_a_id < pool_entry_b_id),
  UNIQUE(pool_entry_a_id, pool_entry_b_id)
);

CREATE INDEX idx_warming_pool_pairs_active ON warming_pool_pairs(is_active) WHERE is_active = true;

-- RLS para pareamentos
ALTER TABLE warming_pool_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pairs involving their entries" ON warming_pool_pairs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM warming_pool 
      WHERE (warming_pool.id = pool_entry_a_id OR warming_pool.id = pool_entry_b_id) 
      AND warming_pool.user_id = auth.uid()
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_warming_pool_updated_at
  BEFORE UPDATE ON warming_pool
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();