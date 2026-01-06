-- 1. Adicionar coluna changed_by à tabela funnel_deal_history para corrigir trigger quebrado
ALTER TABLE public.funnel_deal_history 
ADD COLUMN IF NOT EXISTS changed_by UUID REFERENCES auth.users(id);

-- 2. Corrigir política RLS da tabela profiles (remover acesso público)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own and org member profiles" 
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id 
  OR id IN (SELECT * FROM public.get_organization_member_ids(auth.uid()))
);