-- Criar funcao para contagem agregada de deals por stage
-- Isso evita o limite de 1000 registros do Supabase
CREATE OR REPLACE FUNCTION get_stage_deal_counts(p_funnel_id UUID)
RETURNS TABLE(stage_id UUID, deal_count BIGINT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fd.stage_id, COUNT(*)::BIGINT as deal_count
  FROM funnel_deals fd
  WHERE fd.funnel_id = p_funnel_id
  GROUP BY fd.stage_id;
$$;