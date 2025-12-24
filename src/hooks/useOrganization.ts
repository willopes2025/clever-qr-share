import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { getDefaultPermissions, TeamRole, PermissionKey, hasPermission } from '@/config/permissions';
import { toast } from 'sonner';

export interface Organization {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  organization_id: string;
  user_id: string | null;
  email: string;
  role: TeamRole;
  permissions: Record<string, boolean>;
  status: 'active' | 'invited' | 'inactive';
  invited_at: string;
  joined_at: string | null;
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export function useOrganization() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar organização do usuário
  const { data: organization, isLoading: isLoadingOrg } = useQuery({
    queryKey: ['organization', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Primeiro, tentar encontrar organização onde o usuário é membro
      const { data: memberData } = await supabase
        .from('team_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (memberData) {
        const { data: org } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', memberData.organization_id)
          .maybeSingle();
        return org as Organization | null;
      }

      // Se não for membro, verificar se é dono (pegar a mais recente)
      const { data: ownedOrg } = await supabase
        .from('organizations')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return ownedOrg as Organization | null;
    },
    enabled: !!user,
  });

  // Buscar dados do membro atual
  const { data: currentMember, isLoading: isLoadingMember } = useQuery({
    queryKey: ['current-member', user?.id, organization?.id],
    queryFn: async () => {
      if (!user || !organization) return null;

      const { data } = await supabase
        .from('team_members')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      // Se não encontrar membro, verificar se é o dono
      if (!data && organization.owner_id === user.id) {
        return {
          id: 'owner',
          organization_id: organization.id,
          user_id: user.id,
          email: user.email || '',
          role: 'admin' as TeamRole,
          permissions: getDefaultPermissions('admin'),
          status: 'active' as const,
          invited_at: organization.created_at,
          joined_at: organization.created_at,
          created_at: organization.created_at,
        } as TeamMember;
      }

      return data as TeamMember | null;
    },
    enabled: !!user && !!organization,
  });

  // Criar organização
  const createOrganization = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ owner_id: user.id, name })
        .select()
        .single();

      if (orgError) throw orgError;

      // Adicionar o dono como admin
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          organization_id: org.id,
          user_id: user.id,
          email: user.email || '',
          role: 'admin',
          permissions: getDefaultPermissions('admin'),
          status: 'active',
          joined_at: new Date().toISOString(),
        });

      if (memberError) throw memberError;

      return org as Organization;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      queryClient.invalidateQueries({ queryKey: ['current-member'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Organização criada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar organização:', error);
      toast.error(`Erro ao criar organização: ${error.message}`);
    },
  });

  // Verificar permissão
  const checkPermission = (permission: PermissionKey): boolean => {
    if (!currentMember) {
      // Se é o dono da organização, tem todas as permissões
      if (organization && user && organization.owner_id === user.id) {
        return true;
      }
      return false;
    }
    return hasPermission(currentMember.permissions, permission, currentMember.role);
  };

  const isOwner = organization?.owner_id === user?.id;
  const isAdmin = currentMember?.role === 'admin' || isOwner;

  return {
    organization,
    currentMember,
    isLoading: isLoadingOrg || isLoadingMember,
    isOwner,
    isAdmin,
    checkPermission,
    createOrganization,
  };
}
