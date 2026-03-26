
CREATE TABLE public.funnel_column_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  visible_columns TEXT[] NOT NULL DEFAULT '{}',
  column_order TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, funnel_id)
);

ALTER TABLE public.funnel_column_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own column configs"
  ON public.funnel_column_configs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid())))
  WITH CHECK (user_id = auth.uid());
