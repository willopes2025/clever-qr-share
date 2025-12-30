-- Add assigned_to and first_response_at to conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS first_response_at timestamp with time zone;

-- Add next_action_required to funnel_deals
ALTER TABLE public.funnel_deals 
ADD COLUMN IF NOT EXISTS next_action_required boolean DEFAULT true;

-- Create lead_distribution_settings table
CREATE TABLE IF NOT EXISTS public.lead_distribution_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_enabled boolean DEFAULT false,
  distribution_mode text DEFAULT 'round_robin',
  eligible_members uuid[] DEFAULT '{}',
  last_assigned_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS on lead_distribution_settings
ALTER TABLE public.lead_distribution_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_distribution_settings
CREATE POLICY "Org admins can manage distribution settings"
ON public.lead_distribution_settings FOR ALL
USING (is_org_admin(auth.uid(), organization_id))
WITH CHECK (is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org members can view distribution settings"
ON public.lead_distribution_settings FOR SELECT
USING (user_belongs_to_org(auth.uid(), organization_id));

-- Create sla_metrics table
CREATE TABLE IF NOT EXISTS public.sla_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  organization_id uuid REFERENCES public.organizations(id),
  metric_date date NOT NULL DEFAULT CURRENT_DATE,
  conversations_received integer DEFAULT 0,
  conversations_responded integer DEFAULT 0,
  total_first_response_seconds integer DEFAULT 0,
  avg_first_response_seconds integer DEFAULT 0,
  sla_breached_15min integer DEFAULT 0,
  sla_breached_1h integer DEFAULT 0,
  sla_breached_24h integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, metric_date)
);

-- Enable RLS on sla_metrics
ALTER TABLE public.sla_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies for sla_metrics
CREATE POLICY "Users can view their own metrics"
ON public.sla_metrics FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own metrics"
ON public.sla_metrics FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Org admins can view all org metrics"
ON public.sla_metrics FOR SELECT
USING (organization_id IN (
  SELECT tm.organization_id FROM public.team_members tm 
  WHERE tm.user_id = auth.uid() AND tm.status = 'active' AND tm.role IN ('admin', 'owner')
));

-- Service role policy for webhook updates
CREATE POLICY "Service role can manage all sla_metrics"
ON public.sla_metrics FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON public.conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_conversations_first_response ON public.conversations(first_response_at);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_user_date ON public.sla_metrics(user_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_funnel_deals_next_action ON public.funnel_deals(next_action_required);

-- Trigger to update updated_at on lead_distribution_settings
CREATE TRIGGER update_lead_distribution_settings_updated_at
BEFORE UPDATE ON public.lead_distribution_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update updated_at on sla_metrics
CREATE TRIGGER update_sla_metrics_updated_at
BEFORE UPDATE ON public.sla_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();