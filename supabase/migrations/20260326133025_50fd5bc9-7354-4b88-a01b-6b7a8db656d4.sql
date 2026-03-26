
-- Tabela de conexões webhook
CREATE TABLE public.webhook_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'both',
  webhook_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  target_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_received_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.webhook_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own webhook_connections" ON public.webhook_connections
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Tabela de logs de webhook
CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES public.webhook_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  action TEXT,
  status TEXT DEFAULT 'success',
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own webhook_logs" ON public.webhook_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Policy para inserção de logs (edge function usa service_role, mas para segurança)
CREATE POLICY "Users insert own webhook_logs" ON public.webhook_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Índices para performance
CREATE INDEX idx_webhook_logs_connection_id ON public.webhook_logs(connection_id);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);
CREATE INDEX idx_webhook_connections_token ON public.webhook_connections(webhook_token);
CREATE INDEX idx_webhook_connections_user_id ON public.webhook_connections(user_id);
