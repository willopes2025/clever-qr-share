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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const userId = user?.id;
  const userEmail = user?.email;

  // Buscar organização do usuário
  const { data: organization, isLoading: isLoadingOrg } = useQuery({
    queryKey: ['organization', userId],
    queryFn: async () => {
      if (!userId) return null;

      // Primeiro, tentar encontrar organização onde o usuário é membro
      const { data: memberData } = await supabase
        .from('team_members')
        .select('organization_id')
        .eq('user_id', userId)
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
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return ownedOrg as Organization | null;
    },
    enabled: !!userId,
  });

  // Buscar dados do membro atual
  const organizationId = organization?.id;
  const organizationOwnerId = organization?.owner_id;
  const organizationCreatedAt = organization?.created_at;
  
  const { data: currentMember, isLoading: isLoadingMember } = useQuery({
    queryKey: ['current-member', userId, organizationId],
    queryFn: async () => {
      if (!userId || !organizationId) return null;

      const { data } = await supabase
        .from('team_members')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      // Se não encontrar membro, verificar se é o dono
      if (!data && organizationOwnerId === userId) {
        return {
          id: 'owner',
          organization_id: organizationId,
          user_id: userId,
          email: userEmail || '',
          role: 'admin' as TeamRole,
          permissions: getDefaultPermissions('admin'),
          status: 'active' as const,
          invited_at: organizationCreatedAt,
          joined_at: organizationCreatedAt,
          created_at: organizationCreatedAt,
        } as TeamMember;
      }

      return data as TeamMember | null;
    },
    enabled: !!userId && !!organizationId,
  });

  // Criar organização
  const createOrganization = useMutation({
    mutationFn: async (name: string) => {
      if (!userId) throw new Error('Usuário não autenticado');

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ owner_id: userId, name })
        .select()
        .single();

      if (orgError) throw orgError;

      // Adicionar o dono como admin
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          organization_id: org.id,
          user_id: userId,
          email: userEmail || '',
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

  // Atualizar organização
  const updateOrganization = useMutation({
    mutationFn: async (name: string) => {
      if (!organization) throw new Error('Organização não encontrada');

      const { error } = await supabase
        .from('organizations')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', organization.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast.success('Organização atualizada!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar organização: ${error.message}`);
    },
  });

  // Excluir organização
  const deleteOrganization = useMutation({
    mutationFn: async () => {
      if (!organization) throw new Error('Organização não encontrada');

      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', organization.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      queryClient.invalidateQueries({ queryKey: ['current-member'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Organização excluída com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir organização: ${error.message}`);
    },
  });

  // Verificar permissão
  const checkPermission = (permission: PermissionKey): boolean => {
    if (!currentMember) {
      // Se é o dono da organização, tem todas as permissões
      if (organizationId && userId && organizationOwnerId === userId) {
        return true;
      }
      return false;
    }
    return hasPermission(currentMember.permissions, permission, currentMember.role);
  };

  const isOwner = organizationOwnerId === userId;
  const isAdmin = currentMember?.role === 'admin' || isOwner;

  return {
    organization,
    currentMember,
    isLoading: isLoadingOrg || isLoadingMember,
    isOwner,
    isAdmin,
    checkPermission,
    createOrganization,
    updateOrganization,
    deleteOrganization,
  };
}
