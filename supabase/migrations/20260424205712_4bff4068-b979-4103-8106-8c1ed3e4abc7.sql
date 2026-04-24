-- Tabela de regras de obrigatoriedade por funil/etapa para campos personalizados
CREATE TABLE public.custom_field_required_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_definition_id UUID NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  from_stage_id UUID NOT NULL REFERENCES public.funnel_stages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(field_definition_id, funnel_id)
);

CREATE INDEX idx_cfrr_field ON public.custom_field_required_rules(field_definition_id);
CREATE INDEX idx_cfrr_funnel ON public.custom_field_required_rules(funnel_id);

ALTER TABLE public.custom_field_required_rules ENABLE ROW LEVEL SECURITY;

-- Acesso espelhando custom_field_definitions: dono ou membros ativos da mesma organização
CREATE POLICY "Org members can view required rules"
ON public.custom_field_required_rules
FOR SELECT
USING (
  user_id IN (SELECT public.get_organization_member_ids((SELECT auth.uid())))
);

CREATE POLICY "Org members can insert required rules"
ON public.custom_field_required_rules
FOR INSERT
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR user_id IN (SELECT public.get_organization_member_ids((SELECT auth.uid())))
);

CREATE POLICY "Org members can update required rules"
ON public.custom_field_required_rules
FOR UPDATE
USING (
  user_id IN (SELECT public.get_organization_member_ids((SELECT auth.uid())))
);

CREATE POLICY "Org members can delete required rules"
ON public.custom_field_required_rules
FOR DELETE
USING (
  user_id IN (SELECT public.get_organization_member_ids((SELECT auth.uid())))
);