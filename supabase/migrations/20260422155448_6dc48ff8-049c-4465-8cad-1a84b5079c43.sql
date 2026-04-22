-- 1. Tabelas
CREATE TABLE public.sdr_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sdr_user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  granted_by_owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sdr_user_id, organization_id)
);

CREATE INDEX idx_sdr_assignments_user ON public.sdr_assignments(sdr_user_id);
CREATE INDEX idx_sdr_assignments_org ON public.sdr_assignments(organization_id);

CREATE TABLE public.sdr_instance_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sdr_assignment_id uuid NOT NULL REFERENCES public.sdr_assignments(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sdr_assignment_id, instance_id)
);

CREATE INDEX idx_sdr_instance_access_assignment ON public.sdr_instance_access(sdr_assignment_id);
CREATE INDEX idx_sdr_instance_access_instance ON public.sdr_instance_access(instance_id);

-- meta_number_id refers to meta_whatsapp_numbers.id (uuid) — usado para gerenciamento
CREATE TABLE public.sdr_meta_number_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sdr_assignment_id uuid NOT NULL REFERENCES public.sdr_assignments(id) ON DELETE CASCADE,
  meta_number_id uuid NOT NULL REFERENCES public.meta_whatsapp_numbers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sdr_assignment_id, meta_number_id)
);

CREATE INDEX idx_sdr_meta_number_access_assignment ON public.sdr_meta_number_access(sdr_assignment_id);
CREATE INDEX idx_sdr_meta_number_access_number ON public.sdr_meta_number_access(meta_number_id);

-- 2. Funções
CREATE OR REPLACE FUNCTION public.is_system_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'admin'::app_role) $$;

CREATE OR REPLACE FUNCTION public.is_sdr(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.sdr_assignments WHERE sdr_user_id = _user_id) $$;

CREATE OR REPLACE FUNCTION public.get_sdr_organization_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT organization_id FROM public.sdr_assignments WHERE sdr_user_id = _user_id $$;

CREATE OR REPLACE FUNCTION public.get_sdr_instance_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sia.instance_id
  FROM public.sdr_instance_access sia
  JOIN public.sdr_assignments sa ON sa.id = sia.sdr_assignment_id
  WHERE sa.sdr_user_id = _user_id
$$;

-- IDs uuid em meta_whatsapp_numbers (para gerenciamento)
CREATE OR REPLACE FUNCTION public.get_sdr_meta_number_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT smna.meta_number_id
  FROM public.sdr_meta_number_access smna
  JOIN public.sdr_assignments sa ON sa.id = smna.sdr_assignment_id
  WHERE sa.sdr_user_id = _user_id
$$;

-- IDs text (phone_number_id da Meta) — para casar com conversations.meta_phone_number_id
CREATE OR REPLACE FUNCTION public.get_sdr_meta_phone_number_ids(_user_id uuid)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT mwn.phone_number_id
  FROM public.sdr_meta_number_access smna
  JOIN public.sdr_assignments sa ON sa.id = smna.sdr_assignment_id
  JOIN public.meta_whatsapp_numbers mwn ON mwn.id = smna.meta_number_id
  WHERE sa.sdr_user_id = _user_id AND mwn.phone_number_id IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.get_sdr_user_ids_scope(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT o.owner_id
  FROM public.sdr_assignments sa
  JOIN public.organizations o ON o.id = sa.organization_id
  WHERE sa.sdr_user_id = _user_id
  UNION
  SELECT DISTINCT tm.user_id
  FROM public.sdr_assignments sa
  JOIN public.team_members tm ON tm.organization_id = sa.organization_id
  WHERE sa.sdr_user_id = _user_id AND tm.status = 'active' AND tm.user_id IS NOT NULL
$$;

-- 3. RLS
ALTER TABLE public.sdr_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_instance_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_meta_number_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System owner manages all sdr assignments"
ON public.sdr_assignments FOR ALL TO authenticated
USING (public.is_system_owner(auth.uid()))
WITH CHECK (public.is_system_owner(auth.uid()));

CREATE POLICY "SDR can view own assignments"
ON public.sdr_assignments FOR SELECT TO authenticated
USING (sdr_user_id = auth.uid());

CREATE POLICY "System owner manages all sdr instance access"
ON public.sdr_instance_access FOR ALL TO authenticated
USING (public.is_system_owner(auth.uid()))
WITH CHECK (public.is_system_owner(auth.uid()));

CREATE POLICY "SDR can view own instance access"
ON public.sdr_instance_access FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sdr_assignments sa WHERE sa.id = sdr_assignment_id AND sa.sdr_user_id = auth.uid()));

CREATE POLICY "System owner manages all sdr meta number access"
ON public.sdr_meta_number_access FOR ALL TO authenticated
USING (public.is_system_owner(auth.uid()))
WITH CHECK (public.is_system_owner(auth.uid()));

CREATE POLICY "SDR can view own meta number access"
ON public.sdr_meta_number_access FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sdr_assignments sa WHERE sa.id = sdr_assignment_id AND sa.sdr_user_id = auth.uid()));

-- 4. Acesso para SDR
CREATE POLICY "SDR can view assigned conversations"
ON public.conversations FOR SELECT TO authenticated
USING (
  public.is_sdr(auth.uid()) AND (
    (instance_id IS NOT NULL AND instance_id IN (SELECT public.get_sdr_instance_ids(auth.uid())))
    OR (meta_phone_number_id IS NOT NULL AND meta_phone_number_id IN (SELECT public.get_sdr_meta_phone_number_ids(auth.uid())))
  )
);

CREATE POLICY "SDR can update assigned conversations"
ON public.conversations FOR UPDATE TO authenticated
USING (
  public.is_sdr(auth.uid()) AND (
    (instance_id IS NOT NULL AND instance_id IN (SELECT public.get_sdr_instance_ids(auth.uid())))
    OR (meta_phone_number_id IS NOT NULL AND meta_phone_number_id IN (SELECT public.get_sdr_meta_phone_number_ids(auth.uid())))
  )
);

CREATE POLICY "SDR can view assigned inbox messages"
ON public.inbox_messages FOR SELECT TO authenticated
USING (
  public.is_sdr(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = inbox_messages.conversation_id
      AND ((c.instance_id IS NOT NULL AND c.instance_id IN (SELECT public.get_sdr_instance_ids(auth.uid())))
        OR (c.meta_phone_number_id IS NOT NULL AND c.meta_phone_number_id IN (SELECT public.get_sdr_meta_phone_number_ids(auth.uid()))))
  )
);

CREATE POLICY "SDR can insert messages in assigned conversations"
ON public.inbox_messages FOR INSERT TO authenticated
WITH CHECK (
  public.is_sdr(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = inbox_messages.conversation_id
      AND ((c.instance_id IS NOT NULL AND c.instance_id IN (SELECT public.get_sdr_instance_ids(auth.uid())))
        OR (c.meta_phone_number_id IS NOT NULL AND c.meta_phone_number_id IN (SELECT public.get_sdr_meta_phone_number_ids(auth.uid()))))
  )
);

CREATE POLICY "SDR can view assigned contacts"
ON public.contacts FOR SELECT TO authenticated
USING (public.is_sdr(auth.uid()) AND user_id IN (SELECT public.get_sdr_user_ids_scope(auth.uid())));

CREATE POLICY "SDR can view assigned deals"
ON public.funnel_deals FOR SELECT TO authenticated
USING (public.is_sdr(auth.uid()) AND user_id IN (SELECT public.get_sdr_user_ids_scope(auth.uid())));

CREATE POLICY "SDR can view notes for assigned conversations"
ON public.conversation_notes FOR SELECT TO authenticated
USING (
  public.is_sdr(auth.uid()) AND conversation_id IN (
    SELECT c.id FROM public.conversations c
    WHERE (c.instance_id IS NOT NULL AND c.instance_id IN (SELECT public.get_sdr_instance_ids(auth.uid())))
       OR (c.meta_phone_number_id IS NOT NULL AND c.meta_phone_number_id IN (SELECT public.get_sdr_meta_phone_number_ids(auth.uid())))
  )
);

CREATE POLICY "SDR can create notes for assigned conversations"
ON public.conversation_notes FOR INSERT TO authenticated
WITH CHECK (
  public.is_sdr(auth.uid()) AND user_id = auth.uid()
  AND conversation_id IN (
    SELECT c.id FROM public.conversations c
    WHERE (c.instance_id IS NOT NULL AND c.instance_id IN (SELECT public.get_sdr_instance_ids(auth.uid())))
       OR (c.meta_phone_number_id IS NOT NULL AND c.meta_phone_number_id IN (SELECT public.get_sdr_meta_phone_number_ids(auth.uid())))
  )
);

CREATE POLICY "SDR can view tasks for assigned conversations"
ON public.conversation_tasks FOR SELECT TO authenticated
USING (
  public.is_sdr(auth.uid()) AND conversation_id IN (
    SELECT c.id FROM public.conversations c
    WHERE (c.instance_id IS NOT NULL AND c.instance_id IN (SELECT public.get_sdr_instance_ids(auth.uid())))
       OR (c.meta_phone_number_id IS NOT NULL AND c.meta_phone_number_id IN (SELECT public.get_sdr_meta_phone_number_ids(auth.uid())))
  )
);

CREATE POLICY "SDR can create tasks for assigned conversations"
ON public.conversation_tasks FOR INSERT TO authenticated
WITH CHECK (
  public.is_sdr(auth.uid()) AND user_id = auth.uid()
  AND conversation_id IN (
    SELECT c.id FROM public.conversations c
    WHERE (c.instance_id IS NOT NULL AND c.instance_id IN (SELECT public.get_sdr_instance_ids(auth.uid())))
       OR (c.meta_phone_number_id IS NOT NULL AND c.meta_phone_number_id IN (SELECT public.get_sdr_meta_phone_number_ids(auth.uid())))
  )
);

CREATE POLICY "SDR can update own tasks"
ON public.conversation_tasks FOR UPDATE TO authenticated
USING (public.is_sdr(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "SDR can view assigned instances"
ON public.whatsapp_instances FOR SELECT TO authenticated
USING (public.is_sdr(auth.uid()) AND id IN (SELECT public.get_sdr_instance_ids(auth.uid())));

CREATE POLICY "SDR can view assigned meta numbers"
ON public.meta_whatsapp_numbers FOR SELECT TO authenticated
USING (public.is_sdr(auth.uid()) AND id IN (SELECT public.get_sdr_meta_number_ids(auth.uid())));

CREATE POLICY "SDR can view assigned organizations"
ON public.organizations FOR SELECT TO authenticated
USING (public.is_sdr(auth.uid()) AND id IN (SELECT public.get_sdr_organization_ids(auth.uid())));
