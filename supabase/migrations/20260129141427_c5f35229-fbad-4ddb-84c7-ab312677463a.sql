-- Função para calcular métricas agregadas do funil
CREATE OR REPLACE FUNCTION get_funnel_metrics(p_funnel_id UUID)
RETURNS TABLE(
  open_deals_count BIGINT,
  won_deals_count BIGINT,
  lost_deals_count BIGINT,
  open_deals_value NUMERIC,
  won_deals_value NUMERIC,
  lost_deals_value NUMERIC,
  avg_days_to_close NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH stage_types AS (
    SELECT id, final_type FROM funnel_stages WHERE funnel_id = p_funnel_id
  ),
  deals_with_type AS (
    SELECT 
      fd.*,
      st.final_type
    FROM funnel_deals fd
    JOIN stage_types st ON fd.stage_id = st.id
    WHERE fd.funnel_id = p_funnel_id
  ),
  open_metrics AS (
    SELECT 
      COUNT(*)::BIGINT as count,
      COALESCE(SUM(value), 0)::NUMERIC as total_value
    FROM deals_with_type
    WHERE final_type IS NULL OR final_type NOT IN ('won', 'lost')
  ),
  won_metrics AS (
    SELECT 
      COUNT(*)::BIGINT as count,
      COALESCE(SUM(value), 0)::NUMERIC as total_value,
      COALESCE(AVG(
        EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400
      ), 0)::NUMERIC as avg_days
    FROM deals_with_type
    WHERE final_type = 'won'
  ),
  lost_metrics AS (
    SELECT 
      COUNT(*)::BIGINT as count,
      COALESCE(SUM(value), 0)::NUMERIC as total_value
    FROM deals_with_type
    WHERE final_type = 'lost'
  )
  SELECT 
    o.count as open_deals_count,
    w.count as won_deals_count,
    l.count as lost_deals_count,
    o.total_value as open_deals_value,
    w.total_value as won_deals_value,
    l.total_value as lost_deals_value,
    w.avg_days as avg_days_to_close
  FROM open_metrics o, won_metrics w, lost_metrics l;
$$;