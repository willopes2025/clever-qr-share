CREATE TABLE public.gestao_parts_lead_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id UUID NOT NULL UNIQUE REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id UUID,
  lookup_phone TEXT,
  lookup_document TEXT,
  erp_codigo TEXT,
  erp_nome TEXT,
  pessoa JSONB,
  pedidos JSONB NOT NULL DEFAULT '[]'::jsonb,
  financeiro JSONB NOT NULL DEFAULT '[]'::jsonb,
  credito JSONB,
  pedidos_count INTEGER NOT NULL DEFAULT 0,
  pedidos_total NUMERIC NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_parts_lead_data TO authenticated;
GRANT ALL ON public.gestao_parts_lead_data TO service_role;

ALTER TABLE public.gestao_parts_lead_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view gestao parts lead data"
ON public.gestao_parts_lead_data FOR SELECT TO authenticated
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Org members can insert gestao parts lead data"
ON public.gestao_parts_lead_data FOR INSERT TO authenticated
WITH CHECK (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Org members can update gestao parts lead data"
ON public.gestao_parts_lead_data FOR UPDATE TO authenticated
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Org members can delete gestao parts lead data"
ON public.gestao_parts_lead_data FOR DELETE TO authenticated
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE INDEX idx_gp_lead_data_contact ON public.gestao_parts_lead_data(contact_id);

CREATE TRIGGER update_gestao_parts_lead_data_updated_at
BEFORE UPDATE ON public.gestao_parts_lead_data
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();