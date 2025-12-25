-- Tabela para armazenar integrações de calendário por usuário
CREATE TABLE public.calendar_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'calendly', -- calendly, google_calendar
  api_token TEXT, -- Token de API do Calendly
  access_token TEXT, -- Para OAuth (Google)
  refresh_token TEXT, -- Para OAuth (Google)
  token_expires_at TIMESTAMP WITH TIME ZONE,
  user_uri TEXT, -- URI do usuário no Calendly
  organization_uri TEXT, -- URI da organização no Calendly
  webhook_subscription_id TEXT, -- ID do webhook registrado
  webhook_signing_key TEXT, -- Chave para validar webhooks
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Tabela para armazenar eventos recebidos via webhook
CREATE TABLE public.calendly_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  integration_id UUID REFERENCES public.calendar_integrations(id) ON DELETE CASCADE,
  calendly_event_uri TEXT UNIQUE, -- URI único do evento no Calendly
  event_type TEXT NOT NULL, -- invitee.created, invitee.canceled
  event_name TEXT, -- Nome do tipo de evento (Ex: "Reunião de 30 minutos")
  invitee_name TEXT,
  invitee_email TEXT,
  invitee_phone TEXT,
  event_start_time TIMESTAMP WITH TIME ZONE,
  event_end_time TIMESTAMP WITH TIME ZONE,
  location TEXT, -- Link do Zoom, Google Meet, etc
  cancel_reason TEXT,
  canceled_at TIMESTAMP WITH TIME ZONE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.funnel_deals(id) ON DELETE SET NULL,
  raw_payload JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendly_events ENABLE ROW LEVEL SECURITY;

-- Policies for calendar_integrations
CREATE POLICY "Users can view their own integrations"
  ON public.calendar_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own integrations"
  ON public.calendar_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations"
  ON public.calendar_integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integrations"
  ON public.calendar_integrations FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for calendly_events
CREATE POLICY "Users can view their own events"
  ON public.calendly_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own events"
  ON public.calendly_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
  ON public.calendly_events FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can manage events (for webhook processing)
CREATE POLICY "Service role can manage events"
  ON public.calendly_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage integrations"
  ON public.calendar_integrations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_calendar_integrations_updated_at
  BEFORE UPDATE ON public.calendar_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for better performance
CREATE INDEX idx_calendly_events_user_id ON public.calendly_events(user_id);
CREATE INDEX idx_calendly_events_start_time ON public.calendly_events(event_start_time);
CREATE INDEX idx_calendly_events_contact_id ON public.calendly_events(contact_id);
CREATE INDEX idx_calendar_integrations_user_provider ON public.calendar_integrations(user_id, provider);