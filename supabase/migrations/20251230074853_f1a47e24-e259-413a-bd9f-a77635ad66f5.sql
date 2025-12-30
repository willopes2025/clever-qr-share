-- Tabela de configuração do FusionPBX
CREATE TABLE public.fusionpbx_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Principal',
  host TEXT NOT NULL,
  domain TEXT NOT NULL,
  api_key TEXT,
  esl_port INTEGER NOT NULL DEFAULT 8021,
  esl_password TEXT,
  verto_wss_url TEXT,
  stun_servers TEXT[] DEFAULT ARRAY['stun:stun.l.google.com:19302'],
  turn_servers JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de ramais/extensões
CREATE TABLE public.extensions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  fusionpbx_config_id UUID NOT NULL REFERENCES public.fusionpbx_configs(id) ON DELETE CASCADE,
  extension_number TEXT NOT NULL,
  sip_password TEXT NOT NULL,
  display_name TEXT,
  caller_id_name TEXT,
  caller_id_number TEXT,
  voicemail_enabled BOOLEAN DEFAULT false,
  webrtc_enabled BOOLEAN DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(fusionpbx_config_id, extension_number)
);

-- Tabela de eventos de chamada
CREATE TABLE public.call_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.voip_calls(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar campos em voip_calls
ALTER TABLE public.voip_calls 
ADD COLUMN IF NOT EXISTS fusionpbx_config_id UUID REFERENCES public.fusionpbx_configs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS extension_id UUID REFERENCES public.extensions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS freeswitch_uuid TEXT,
ADD COLUMN IF NOT EXISTS channel_name TEXT,
ADD COLUMN IF NOT EXISTS transfer_from_call_id UUID REFERENCES public.voip_calls(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS call_type TEXT DEFAULT 'human',
ADD COLUMN IF NOT EXISTS ai_agent_config_id UUID REFERENCES public.ai_agent_configs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS transcription TEXT,
ADD COLUMN IF NOT EXISTS recording_storage_path TEXT;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_fusionpbx_configs_user_id ON public.fusionpbx_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_extensions_user_id ON public.extensions(user_id);
CREATE INDEX IF NOT EXISTS idx_extensions_fusionpbx_config_id ON public.extensions(fusionpbx_config_id);
CREATE INDEX IF NOT EXISTS idx_call_events_call_id ON public.call_events(call_id);
CREATE INDEX IF NOT EXISTS idx_call_events_created_at ON public.call_events(created_at);
CREATE INDEX IF NOT EXISTS idx_voip_calls_freeswitch_uuid ON public.voip_calls(freeswitch_uuid);

-- Enable RLS
ALTER TABLE public.fusionpbx_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_events ENABLE ROW LEVEL SECURITY;

-- Policies para fusionpbx_configs
CREATE POLICY "Users can view their own fusionpbx configs" 
ON public.fusionpbx_configs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own fusionpbx configs" 
ON public.fusionpbx_configs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fusionpbx configs" 
ON public.fusionpbx_configs FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fusionpbx configs" 
ON public.fusionpbx_configs FOR DELETE 
USING (auth.uid() = user_id);

-- Policies para extensions
CREATE POLICY "Users can view their own extensions" 
ON public.extensions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own extensions" 
ON public.extensions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own extensions" 
ON public.extensions FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own extensions" 
ON public.extensions FOR DELETE 
USING (auth.uid() = user_id);

-- Policies para call_events (via voip_calls ownership)
CREATE POLICY "Users can view call events for their calls" 
ON public.call_events FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.voip_calls 
    WHERE voip_calls.id = call_events.call_id 
    AND voip_calls.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert call events for their calls" 
ON public.call_events FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.voip_calls 
    WHERE voip_calls.id = call_events.call_id 
    AND voip_calls.user_id = auth.uid()
  )
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fusionpbx_configs_updated_at
BEFORE UPDATE ON public.fusionpbx_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_extensions_updated_at
BEFORE UPDATE ON public.extensions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime para call_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_events;