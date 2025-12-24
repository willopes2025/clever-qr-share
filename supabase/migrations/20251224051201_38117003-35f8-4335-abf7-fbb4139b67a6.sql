-- Enum para tipos de automação
CREATE TYPE public.funnel_trigger_type AS ENUM ('on_stage_enter', 'on_stage_exit', 'on_deal_won', 'on_deal_lost', 'on_time_in_stage');
CREATE TYPE public.funnel_action_type AS ENUM ('send_message', 'send_template', 'add_tag', 'remove_tag', 'notify_user', 'move_stage');

-- Tabela de Funis
CREATE TABLE public.funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  color TEXT DEFAULT '#3B82F6',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own funnels" ON public.funnels
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own funnels" ON public.funnels
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own funnels" ON public.funnels
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own funnels" ON public.funnels
  FOR DELETE USING (auth.uid() = user_id);

-- Tabela de Etapas do Funil
CREATE TABLE public.funnel_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  display_order INTEGER DEFAULT 0,
  is_final BOOLEAN DEFAULT false,
  final_type TEXT CHECK (final_type IN ('won', 'lost', NULL)),
  probability INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.funnel_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stages of their funnels" ON public.funnel_stages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.funnels WHERE funnels.id = funnel_stages.funnel_id AND funnels.user_id = auth.uid()
  ));
CREATE POLICY "Users can create stages in their funnels" ON public.funnel_stages
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.funnels WHERE funnels.id = funnel_stages.funnel_id AND funnels.user_id = auth.uid()
  ));
CREATE POLICY "Users can update stages in their funnels" ON public.funnel_stages
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.funnels WHERE funnels.id = funnel_stages.funnel_id AND funnels.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete stages in their funnels" ON public.funnel_stages
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.funnels WHERE funnels.id = funnel_stages.funnel_id AND funnels.user_id = auth.uid()
  ));

-- Tabela de Motivos de Fechamento
CREATE TABLE public.funnel_close_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('won', 'lost')),
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.funnel_close_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own close reasons" ON public.funnel_close_reasons
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own close reasons" ON public.funnel_close_reasons
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own close reasons" ON public.funnel_close_reasons
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own close reasons" ON public.funnel_close_reasons
  FOR DELETE USING (auth.uid() = user_id);

-- Tabela de Deals
CREATE TABLE public.funnel_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.funnel_stages(id),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id),
  title TEXT,
  value DECIMAL(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  expected_close_date DATE,
  closed_at TIMESTAMPTZ,
  close_reason_id UUID REFERENCES public.funnel_close_reasons(id),
  source TEXT,
  notes TEXT,
  entered_stage_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.funnel_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deals" ON public.funnel_deals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own deals" ON public.funnel_deals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own deals" ON public.funnel_deals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own deals" ON public.funnel_deals
  FOR DELETE USING (auth.uid() = user_id);

-- Tabela de Histórico de Deals
CREATE TABLE public.funnel_deal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.funnel_deals(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES public.funnel_stages(id),
  to_stage_id UUID REFERENCES public.funnel_stages(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

ALTER TABLE public.funnel_deal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view history of their deals" ON public.funnel_deal_history
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.funnel_deals WHERE funnel_deals.id = funnel_deal_history.deal_id AND funnel_deals.user_id = auth.uid()
  ));
CREATE POLICY "Users can create history for their deals" ON public.funnel_deal_history
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.funnel_deals WHERE funnel_deals.id = funnel_deal_history.deal_id AND funnel_deals.user_id = auth.uid()
  ));

-- Tabela de Automações
CREATE TABLE public.funnel_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.funnel_stages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type public.funnel_trigger_type NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  action_type public.funnel_action_type NOT NULL,
  action_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.funnel_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own automations" ON public.funnel_automations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own automations" ON public.funnel_automations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own automations" ON public.funnel_automations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own automations" ON public.funnel_automations
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_funnels_updated_at BEFORE UPDATE ON public.funnels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_funnel_deals_updated_at BEFORE UPDATE ON public.funnel_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_funnel_automations_updated_at BEFORE UPDATE ON public.funnel_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_funnel_deals_funnel_id ON public.funnel_deals(funnel_id);
CREATE INDEX idx_funnel_deals_stage_id ON public.funnel_deals(stage_id);
CREATE INDEX idx_funnel_deals_contact_id ON public.funnel_deals(contact_id);
CREATE INDEX idx_funnel_stages_funnel_id ON public.funnel_stages(funnel_id);
CREATE INDEX idx_funnel_automations_stage_id ON public.funnel_automations(stage_id);