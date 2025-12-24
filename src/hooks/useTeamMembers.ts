import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization, TeamMember } from './useOrganization';
import { getDefaultPermissions, TeamRole, PermissionKey } from '@/config/permissions';
import { toast } from 'sonner';

export function useTeamMembers() {
  const { organization, isAdmin } = useOrganization();
  const queryClient = useQueryClient();

  // Buscar membros da equipe
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team-members', organization?.id],
    queryFn: async () => {
      if (!organization) return [];

      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Buscar profiles dos membros que têm user_id
      const userIds = data.filter(m => m.user_id).map(m => m.user_id);
      let profiles: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);
        
        if (profilesData) {
          profiles = profilesData.reduce((acc, p) => {
            acc[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
            return acc;
          }, {} as Record<string, { full_name: string | null; avatar_url: string | null }>);
        }
      }
      
      return data.map(m => ({
        ...m,
        profile: m.user_id ? profiles[m.user_id] || null : null,
      })) as TeamMember[];
    },
    enabled: !!organization,
  });

  // Convidar membro
  const inviteMember = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: TeamRole }) => {
      if (!organization) throw new Error('Organização não encontrada');
      if (!isAdmin) throw new Error('Sem permissão para convidar membros');

      const { data, error } = await supabase
        .from('team_members')
        .insert({
          organization_id: organization.id,
          email,
          role,
          permissions: getDefaultPermissions(role),
          status: 'invited',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este email já foi convidado');
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Convite enviado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Atualizar role do membro
  const updateMemberRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: TeamRole }) => {
      if (!isAdmin) throw new Error('Sem permissão para alterar roles');

      const { error } = await supabase
        .from('team_members')
        .update({ 
          role,
          permissions: getDefaultPermissions(role),
        })
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Role atualizada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Atualizar permissões do membro
  const updateMemberPermissions = useMutation({
    mutationFn: async ({ memberId, permissions }: { memberId: string; permissions: Record<PermissionKey, boolean> }) => {
      if (!isAdmin) throw new Error('Sem permissão para alterar permissões');

      const { error } = await supabase
        .from('team_members')
        .update({ permissions })
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Permissões atualizadas!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Remover membro
  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      if (!isAdmin) throw new Error('Sem permissão para remover membros');

      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Membro removido da equipe');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Ativar membro (quando aceita convite)
  const activateMember = useMutation({
    mutationFn: async ({ memberId, userId }: { memberId: string; userId: string }) => {
      const { error } = await supabase
        .from('team_members')
        .update({ 
          status: 'active',
          user_id: userId,
          joined_at: new Date().toISOString(),
        })
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      queryClient.invalidateQueries({ queryKey: ['current-member'] });
    },
  });

  return {
    members,
    isLoading,
    inviteMember,
    updateMemberRole,
    updateMemberPermissions,
    removeMember,
    activateMember,
  };
}
