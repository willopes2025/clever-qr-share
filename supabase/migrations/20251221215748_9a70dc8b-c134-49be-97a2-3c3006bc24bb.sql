-- Create warming_schedules table
CREATE TABLE public.warming_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'paused' CHECK (status IN ('active', 'paused', 'completed')),
  start_date TIMESTAMP WITH TIME ZONE,
  current_day INTEGER NOT NULL DEFAULT 0,
  target_days INTEGER NOT NULL DEFAULT 21,
  messages_sent_today INTEGER NOT NULL DEFAULT 0,
  messages_target_today INTEGER NOT NULL DEFAULT 10,
  messages_received_today INTEGER NOT NULL DEFAULT 0,
  total_messages_sent INTEGER NOT NULL DEFAULT 0,
  total_messages_received INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(instance_id)
);

-- Create warming_contacts table (manual test contacts)
CREATE TABLE public.warming_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  type TEXT NOT NULL DEFAULT 'individual' CHECK (type IN ('individual', 'group')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create warming_pairs table (instance pairing)
CREATE TABLE public.warming_pairs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  instance_a_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  instance_b_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(instance_a_id, instance_b_id)
);

-- Create warming_content table (content bank)
CREATE TABLE public.warming_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'audio', 'image', 'video', 'sticker')),
  content TEXT,
  media_url TEXT,
  category TEXT NOT NULL DEFAULT 'casual' CHECK (category IN ('greeting', 'casual', 'question', 'reaction', 'farewell')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create warming_activities table (activity log)
CREATE TABLE public.warming_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.warming_schedules(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('send_text', 'send_audio', 'send_image', 'send_video', 'send_sticker', 'receive_message')),
  contact_phone TEXT,
  content_preview TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.warming_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warming_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warming_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warming_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warming_activities ENABLE ROW LEVEL SECURITY;

-- RLS policies for warming_schedules
CREATE POLICY "Users can view their own warming schedules" ON public.warming_schedules
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own warming schedules" ON public.warming_schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own warming schedules" ON public.warming_schedules
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own warming schedules" ON public.warming_schedules
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for warming_contacts
CREATE POLICY "Users can view their own warming contacts" ON public.warming_contacts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own warming contacts" ON public.warming_contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own warming contacts" ON public.warming_contacts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own warming contacts" ON public.warming_contacts
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for warming_pairs
CREATE POLICY "Users can view their own warming pairs" ON public.warming_pairs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own warming pairs" ON public.warming_pairs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own warming pairs" ON public.warming_pairs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own warming pairs" ON public.warming_pairs
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for warming_content
CREATE POLICY "Users can view their own warming content" ON public.warming_content
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own warming content" ON public.warming_content
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own warming content" ON public.warming_content
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own warming content" ON public.warming_content
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for warming_activities
CREATE POLICY "Users can view their warming activities" ON public.warming_activities
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.warming_schedules 
    WHERE warming_schedules.id = warming_activities.schedule_id 
    AND warming_schedules.user_id = auth.uid()
  ));
CREATE POLICY "Users can create their warming activities" ON public.warming_activities
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.warming_schedules 
    WHERE warming_schedules.id = warming_activities.schedule_id 
    AND warming_schedules.user_id = auth.uid()
  ));

-- Create trigger for updated_at on warming_schedules
CREATE TRIGGER update_warming_schedules_updated_at
  BEFORE UPDATE ON public.warming_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default warming content (casual messages in Portuguese)
INSERT INTO public.warming_content (user_id, content_type, content, category) VALUES
  ('00000000-0000-0000-0000-000000000000', 'text', 'Oi! Tudo bem?', 'greeting'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'E aí, como vai?', 'greeting'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Bom dia! ☀️', 'greeting'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Boa tarde!', 'greeting'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Boa noite! 🌙', 'greeting'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Tranquilo por aqui, e vc?', 'casual'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Tudo certo! Trabalhando aqui', 'casual'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Sim sim, tá tudo bem', 'casual'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Aqui tá de boa 👍', 'casual'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Correria por aqui haha', 'casual'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'O que você tá fazendo?', 'question'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Viu aquele jogo ontem?', 'question'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Qual seu plano pro fim de semana?', 'question'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Já almoçou?', 'question'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Tá trabalhando muito?', 'question'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Haha boa!', 'reaction'),
  ('00000000-0000-0000-0000-000000000000', 'text', '😂😂', 'reaction'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Entendi!', 'reaction'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Show!', 'reaction'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Top demais 👏', 'reaction'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Beleza, até mais!', 'farewell'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Falou, abraço!', 'farewell'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Tchau! 👋', 'farewell'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Até depois!', 'farewell'),
  ('00000000-0000-0000-0000-000000000000', 'text', 'Bom descanso!', 'farewell');

-- Create policy for default content (user_id = null UUID means system content)
CREATE POLICY "Anyone can view default warming content" ON public.warming_content
  FOR SELECT USING (user_id = '00000000-0000-0000-0000-000000000000');