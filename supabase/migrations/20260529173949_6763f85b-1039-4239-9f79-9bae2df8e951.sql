CREATE TABLE public.training_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  step_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, step_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_progress TO authenticated;
GRANT ALL ON public.training_progress TO service_role;

ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own training progress"
ON public.training_progress FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own training progress"
ON public.training_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own training progress"
ON public.training_progress FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_training_progress_user ON public.training_progress(user_id);