-- Create deal_tasks table
CREATE TABLE public.deal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  deal_id UUID NOT NULL REFERENCES public.funnel_deals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  priority TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own deal tasks"
ON public.deal_tasks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deal tasks"
ON public.deal_tasks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deal tasks"
ON public.deal_tasks FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deal tasks"
ON public.deal_tasks FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_deal_tasks_updated_at
BEFORE UPDATE ON public.deal_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();