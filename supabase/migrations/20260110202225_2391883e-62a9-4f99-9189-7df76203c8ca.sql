-- Add widget_type column to available_widgets
ALTER TABLE public.available_widgets 
ADD COLUMN IF NOT EXISTS widget_type text DEFAULT 'kpi';

-- Update existing widgets to have 'kpi' type
UPDATE public.available_widgets SET widget_type = 'kpi' WHERE widget_type IS NULL;

-- Insert new graphic widgets
INSERT INTO public.available_widgets (widget_key, name, description, category, icon, widget_type, default_size, size_options, is_active, display_order)
VALUES 
  ('grafico_leads_periodo', 'Evolução de Leads', 'Gráfico de área mostrando leads ao longo do tempo', 'leads', 'TrendingUp', 'area_chart', 'medium', ARRAY['medium', 'large'], true, 100),
  ('grafico_deals_resultado', 'Resultado de Deals', 'Gráfico de pizza mostrando deals ganhos vs perdidos', 'vendas', 'PieChart', 'pie_chart', 'small', ARRAY['small', 'medium'], true, 101),
  ('grafico_deals_etapa', 'Deals por Etapa', 'Gráfico de barras mostrando deals em cada etapa do funil', 'vendas', 'BarChart3', 'bar_chart', 'medium', ARRAY['medium', 'large'], true, 102),
  ('grafico_mensagens_periodo', 'Mensagens por Período', 'Gráfico de barras com mensagens enviadas e recebidas', 'atendimento', 'BarChart', 'bar_chart', 'medium', ARRAY['medium', 'large'], true, 103),
  ('grafico_conversas_status', 'Status das Conversas', 'Gráfico de pizza mostrando distribuição de status', 'atendimento', 'PieChart', 'pie_chart', 'small', ARRAY['small', 'medium'], true, 104),
  ('grafico_automacao_periodo', 'Execuções de Automação', 'Gráfico de área mostrando execuções do chatbot', 'automacao', 'Activity', 'area_chart', 'medium', ARRAY['medium', 'large'], true, 105),
  ('grafico_tarefas_status', 'Status das Tarefas', 'Gráfico de pizza com tarefas pendentes, concluídas e atrasadas', 'tarefas', 'PieChart', 'pie_chart', 'small', ARRAY['small', 'medium'], true, 106),
  ('grafico_produtividade', 'Produtividade Semanal', 'Gráfico de barras com horas trabalhadas por dia', 'performance', 'BarChart3', 'bar_chart', 'medium', ARRAY['medium', 'large'], true, 107)
ON CONFLICT (widget_key) DO UPDATE SET
  widget_type = EXCLUDED.widget_type,
  default_size = EXCLUDED.default_size,
  size_options = EXCLUDED.size_options;