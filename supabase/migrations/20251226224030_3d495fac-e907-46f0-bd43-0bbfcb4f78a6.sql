-- Adicionar colunas para controle de leads na tabela subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS max_leads INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS leads_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS leads_reset_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

-- Criar tabela de log de uso de leads
CREATE TABLE IF NOT EXISTS public.lead_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  leads_consumed INTEGER NOT NULL,
  search_query JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS para lead_usage_log
ALTER TABLE public.lead_usage_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para lead_usage_log
CREATE POLICY "Users can view own lead usage"
  ON public.lead_usage_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own lead usage"
  ON public.lead_usage_log FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can manage lead usage"
  ON public.lead_usage_log FOR ALL
  USING (true)
  WITH CHECK (true);

-- Função para resetar leads mensalmente
CREATE OR REPLACE FUNCTION public.reset_leads_monthly()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscriptions
  SET leads_used = 0, leads_reset_at = now()
  WHERE leads_reset_at < now() - interval '1 month';
END;
$$;