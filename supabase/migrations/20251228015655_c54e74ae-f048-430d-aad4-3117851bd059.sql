-- Tabela principal de fluxos de chatbot
CREATE TABLE public.chatbot_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  trigger_type TEXT DEFAULT 'on_message',
  trigger_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Nodes do fluxo (os cards visuais)
CREATE TABLE public.chatbot_flow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES public.chatbot_flows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  position_x FLOAT NOT NULL DEFAULT 0,
  position_y FLOAT NOT NULL DEFAULT 0,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Conexões entre nodes (edges)
CREATE TABLE public.chatbot_flow_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES public.chatbot_flows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  source_node_id UUID NOT NULL REFERENCES public.chatbot_flow_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES public.chatbot_flow_nodes(id) ON DELETE CASCADE,
  source_handle TEXT,
  target_handle TEXT,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chatbot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_flow_edges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chatbot_flows
CREATE POLICY "Users can view their own flows" ON public.chatbot_flows
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own flows" ON public.chatbot_flows
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own flows" ON public.chatbot_flows
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own flows" ON public.chatbot_flows
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chatbot_flow_nodes
CREATE POLICY "Users can view their own nodes" ON public.chatbot_flow_nodes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own nodes" ON public.chatbot_flow_nodes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own nodes" ON public.chatbot_flow_nodes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own nodes" ON public.chatbot_flow_nodes
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chatbot_flow_edges
CREATE POLICY "Users can view their own edges" ON public.chatbot_flow_edges
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own edges" ON public.chatbot_flow_edges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own edges" ON public.chatbot_flow_edges
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own edges" ON public.chatbot_flow_edges
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_chatbot_flows_updated_at
  BEFORE UPDATE ON public.chatbot_flows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();