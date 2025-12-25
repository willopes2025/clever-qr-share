-- Drop existing foreign key constraints
ALTER TABLE public.funnel_deal_history 
DROP CONSTRAINT IF EXISTS funnel_deal_history_from_stage_id_fkey;

ALTER TABLE public.funnel_deal_history 
DROP CONSTRAINT IF EXISTS funnel_deal_history_to_stage_id_fkey;

-- Recreate with ON DELETE SET NULL to preserve history when stages are deleted
ALTER TABLE public.funnel_deal_history 
ADD CONSTRAINT funnel_deal_history_from_stage_id_fkey 
FOREIGN KEY (from_stage_id) REFERENCES public.funnel_stages(id) ON DELETE SET NULL;

ALTER TABLE public.funnel_deal_history 
ADD CONSTRAINT funnel_deal_history_to_stage_id_fkey 
FOREIGN KEY (to_stage_id) REFERENCES public.funnel_stages(id) ON DELETE SET NULL;