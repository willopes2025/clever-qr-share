-- Criar tabela de profiles para armazenar dados dos usuários
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies para profiles
CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Trigger para criar profile automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data ->> 'full_name', new.email));
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Criar tabela de organizações
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Criar tabela de membros da equipe
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  permissions jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('active', 'invited', 'inactive')),
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, email)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Função para verificar se usuário é membro de uma organização
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.team_members
  WHERE user_id = _user_id AND status = 'active'
  LIMIT 1
$$;

-- Função para verificar role do usuário na organização
CREATE OR REPLACE FUNCTION public.get_user_team_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.team_members
  WHERE user_id = _user_id AND status = 'active'
  LIMIT 1
$$;

-- Policies para organizations
CREATE POLICY "Users can view their organization"
ON public.organizations FOR SELECT
USING (
  id IN (SELECT organization_id FROM public.team_members WHERE user_id = auth.uid() AND status = 'active')
  OR owner_id = auth.uid()
);

CREATE POLICY "Owners can update their organization"
ON public.organizations FOR UPDATE
USING (owner_id = auth.uid());

CREATE POLICY "Users can create organizations"
ON public.organizations FOR INSERT
WITH CHECK (owner_id = auth.uid());

-- Policies para team_members
CREATE POLICY "Members can view their team"
ON public.team_members FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.team_members WHERE user_id = auth.uid() AND status = 'active'
  )
  OR organization_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
);

CREATE POLICY "Admins can insert team members"
ON public.team_members FOR INSERT
WITH CHECK (
  organization_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
  OR (
    organization_id IN (
      SELECT organization_id FROM public.team_members 
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  )
);

CREATE POLICY "Admins can update team members"
ON public.team_members FOR UPDATE
USING (
  organization_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
  OR (
    organization_id IN (
      SELECT organization_id FROM public.team_members 
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  )
);

CREATE POLICY "Admins can delete team members"
ON public.team_members FOR DELETE
USING (
  organization_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
  OR (
    organization_id IN (
      SELECT organization_id FROM public.team_members 
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  )
);

-- Adicionar coluna sent_by_user_id em inbox_messages
ALTER TABLE public.inbox_messages 
ADD COLUMN sent_by_user_id uuid REFERENCES auth.users(id);

-- Criar trigger para atualizar updated_at em profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar trigger para atualizar updated_at em organizations
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();