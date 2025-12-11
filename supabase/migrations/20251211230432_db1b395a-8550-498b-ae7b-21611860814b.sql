-- Criar tabela para instâncias do WhatsApp
CREATE TABLE public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'connecting')),
  qr_code TEXT,
  qr_code_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, instance_name)
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own instances"
  ON public.whatsapp_instances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own instances"
  ON public.whatsapp_instances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own instances"
  ON public.whatsapp_instances FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own instances"
  ON public.whatsapp_instances FOR DELETE
  USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX idx_whatsapp_instances_user_id ON public.whatsapp_instances(user_id);
CREATE INDEX idx_whatsapp_instances_status ON public.whatsapp_instances(status);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_instances_updated_at
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();