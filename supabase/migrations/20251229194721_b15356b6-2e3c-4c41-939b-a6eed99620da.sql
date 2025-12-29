
-- Create table for ElevenLabs SIP Trunk configuration
CREATE TABLE public.elevenlabs_sip_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone_number_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Principal',
  sip_username TEXT,
  sip_domain TEXT DEFAULT 'vono2.me',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for AI phone calls
CREATE TABLE public.ai_phone_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id),
  conversation_id UUID REFERENCES public.conversations(id),
  agent_config_id UUID REFERENCES public.ai_agent_configs(id),
  sip_config_id UUID REFERENCES public.elevenlabs_sip_config(id),
  elevenlabs_conversation_id TEXT,
  sip_call_id TEXT,
  to_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'initiating',
  duration_seconds INTEGER DEFAULT 0,
  transcript TEXT,
  recording_url TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.elevenlabs_sip_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_phone_calls ENABLE ROW LEVEL SECURITY;

-- RLS policies for elevenlabs_sip_config
CREATE POLICY "Users can view their own SIP config"
  ON public.elevenlabs_sip_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own SIP config"
  ON public.elevenlabs_sip_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own SIP config"
  ON public.elevenlabs_sip_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own SIP config"
  ON public.elevenlabs_sip_config FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for ai_phone_calls
CREATE POLICY "Users can view their own AI calls"
  ON public.ai_phone_calls FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AI calls"
  ON public.ai_phone_calls FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI calls"
  ON public.ai_phone_calls FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can manage all calls (for webhooks)
CREATE POLICY "Service role can manage all AI calls"
  ON public.ai_phone_calls FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX idx_ai_phone_calls_user_id ON public.ai_phone_calls(user_id);
CREATE INDEX idx_ai_phone_calls_contact_id ON public.ai_phone_calls(contact_id);
CREATE INDEX idx_ai_phone_calls_status ON public.ai_phone_calls(status);
CREATE INDEX idx_elevenlabs_sip_config_user_id ON public.elevenlabs_sip_config(user_id);
