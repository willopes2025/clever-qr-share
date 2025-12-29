-- Configurações VoIP por organização
CREATE TABLE public.voip_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'vono',
  domain TEXT NOT NULL DEFAULT 'vono.me',
  api_token TEXT NOT NULL,
  api_key TEXT NOT NULL,
  default_device_id TEXT,
  default_src_number TEXT,
  elevenlabs_agent_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voip_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own voip configs"
  ON public.voip_configurations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own voip configs"
  ON public.voip_configurations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voip configs"
  ON public.voip_configurations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voip configs"
  ON public.voip_configurations FOR DELETE
  USING (auth.uid() = user_id);

-- Histórico de chamadas
CREATE TABLE public.voip_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.funnel_deals(id) ON DELETE SET NULL,
  voip_config_id UUID REFERENCES public.voip_configurations(id) ON DELETE SET NULL,
  
  external_call_id TEXT,
  device_id TEXT,
  caller TEXT NOT NULL,
  called TEXT NOT NULL,
  direction TEXT DEFAULT 'outbound',
  status TEXT DEFAULT 'pending',
  duration_seconds INTEGER,
  
  ai_enabled BOOLEAN DEFAULT false,
  ai_transcript TEXT,
  elevenlabs_conversation_id TEXT,
  
  recording_id TEXT,
  recording_url TEXT,
  
  started_at TIMESTAMPTZ DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voip_calls ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view organization voip calls"
  ON public.voip_calls FOR SELECT
  USING (
    user_id = auth.uid() OR 
    user_id IN (SELECT get_organization_member_ids(auth.uid()))
  );

CREATE POLICY "Users can create their own voip calls"
  ON public.voip_calls FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voip calls"
  ON public.voip_calls FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voip calls"
  ON public.voip_calls FOR DELETE
  USING (auth.uid() = user_id);

-- Linhas IP gerenciadas
CREATE TABLE public.voip_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  voip_config_id UUID REFERENCES public.voip_configurations(id) ON DELETE CASCADE,
  
  external_line_id TEXT NOT NULL,
  line_number TEXT NOT NULL,
  description TEXT,
  caller_id TEXT,
  status TEXT DEFAULT 'active',
  is_default BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voip_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own voip lines"
  ON public.voip_lines FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own voip lines"
  ON public.voip_lines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voip lines"
  ON public.voip_lines FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voip lines"
  ON public.voip_lines FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_voip_calls_user_id ON public.voip_calls(user_id);
CREATE INDEX idx_voip_calls_contact_id ON public.voip_calls(contact_id);
CREATE INDEX idx_voip_calls_conversation_id ON public.voip_calls(conversation_id);
CREATE INDEX idx_voip_calls_created_at ON public.voip_calls(created_at DESC);
CREATE INDEX idx_voip_configurations_user_id ON public.voip_configurations(user_id);
CREATE INDEX idx_voip_lines_voip_config_id ON public.voip_lines(voip_config_id);