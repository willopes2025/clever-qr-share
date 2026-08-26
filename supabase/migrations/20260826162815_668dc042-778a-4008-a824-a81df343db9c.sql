DROP POLICY IF EXISTS "Admins can update orcamento config" ON public.gestao_parts_orcamento_config;
DROP POLICY IF EXISTS "Authenticated can manage vendedores" ON public.gestao_parts_vendedores;

CREATE POLICY "Admins can update orcamento config"
ON public.gestao_parts_orcamento_config
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert orcamento config"
ON public.gestao_parts_orcamento_config
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage vendedores"
ON public.gestao_parts_vendedores
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));