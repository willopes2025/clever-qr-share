
-- Permitir que membros ATIVOS de uma organização vejam todas as instâncias
-- da org quando NÃO tiverem restrição configurada (team_member_instances vazio).
-- Quando tiverem restrição, o filtro de get_member_instance_ids continua valendo.

DROP POLICY IF EXISTS "Members view assigned instances" ON public.whatsapp_instances;

CREATE POLICY "Members view assigned instances"
ON public.whatsapp_instances
FOR SELECT
USING (
  -- Próprias instâncias
  auth.uid() = user_id
  -- Owner enxerga instâncias dos membros da sua org
  OR EXISTS (
    SELECT 1
    FROM organizations o
    JOIN team_members tm ON tm.organization_id = o.id
    WHERE o.owner_id = auth.uid()
      AND tm.status = 'active'
      AND tm.user_id = whatsapp_instances.user_id
  )
  -- Membro com restrição: somente as instâncias atribuídas
  OR (
    member_has_instance_restriction(auth.uid())
    AND id IN (SELECT get_member_instance_ids(auth.uid()))
  )
  -- Membro SEM restrição: vê todas as instâncias da própria organização
  -- (qualquer user_id que pertença à mesma org do membro logado, incluindo o owner)
  OR (
    NOT member_has_instance_restriction(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM team_members tm_self
      WHERE tm_self.user_id = auth.uid()
        AND tm_self.status = 'active'
        AND (
          -- instância pertence ao owner da mesma org
          EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = tm_self.organization_id
              AND o.owner_id = whatsapp_instances.user_id
          )
          -- ou pertence a outro membro ativo da mesma org
          OR EXISTS (
            SELECT 1 FROM team_members tm_other
            WHERE tm_other.organization_id = tm_self.organization_id
              AND tm_other.status = 'active'
              AND tm_other.user_id = whatsapp_instances.user_id
          )
        )
    )
  )
);

-- Mesma lógica para meta_whatsapp_numbers
DROP POLICY IF EXISTS "Members view assigned meta numbers" ON public.meta_whatsapp_numbers;

CREATE POLICY "Members view assigned meta numbers"
ON public.meta_whatsapp_numbers
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM organizations o
    JOIN team_members tm ON tm.organization_id = o.id
    WHERE o.owner_id = auth.uid()
      AND tm.status = 'active'
      AND tm.user_id = meta_whatsapp_numbers.user_id
  )
  OR (
    member_has_meta_restriction(auth.uid())
    AND id IN (SELECT get_member_meta_number_ids(auth.uid()))
  )
  OR (
    NOT member_has_meta_restriction(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM team_members tm_self
      WHERE tm_self.user_id = auth.uid()
        AND tm_self.status = 'active'
        AND (
          EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = tm_self.organization_id
              AND o.owner_id = meta_whatsapp_numbers.user_id
          )
          OR EXISTS (
            SELECT 1 FROM team_members tm_other
            WHERE tm_other.organization_id = tm_self.organization_id
              AND tm_other.status = 'active'
              AND tm_other.user_id = meta_whatsapp_numbers.user_id
          )
        )
    )
  )
);
