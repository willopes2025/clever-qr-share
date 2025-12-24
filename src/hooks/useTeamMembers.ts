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
    mutationFn: async ({ email, role, inviterName }: { email: string; role: TeamRole; inviterName?: string }): Promise<{ emailSent: boolean; organizationName: string }> => {
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

      // Enviar email de convite
      let emailSent = false;
      try {
        const { error: emailError, data: emailData } = await supabase.functions.invoke('send-team-invite', {
          body: {
            email,
            role,
            organizationName: organization.name,
            inviterName: inviterName || 'Um administrador',
          },
        });

        if (emailError) {
          console.error('Erro ao enviar email de convite:', emailError);
        } else if (emailData?.success === false) {
          console.error('Email não enviado:', emailData?.error);
        } else {
          emailSent = true;
        }
      } catch (emailErr) {
        console.error('Erro ao enviar email de convite:', emailErr);
      }

      return { emailSent, organizationName: organization.name };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      if (data.emailSent) {
        toast.success('Convite enviado com sucesso!');
      }
      // Se email não foi enviado, o dialog vai mostrar o fallback
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

  // Editar membro
  const updateMember = useMutation({
    mutationFn: async ({ memberId, data }: { memberId: string; data: { name?: string; email?: string; role: TeamRole } }) => {
      if (!isAdmin) throw new Error('Sem permissão para editar membros');

      const member = members.find(m => m.id === memberId);
      if (!member) throw new Error('Membro não encontrado');

      // Atualizar role e email (se pendente)
      const updateData: Record<string, unknown> = {
        role: data.role,
        permissions: getDefaultPermissions(data.role),
      };

      if (member.status === 'invited' && data.email) {
        updateData.email = data.email;
      }

      const { error } = await supabase
        .from('team_members')
        .update(updateData)
        .eq('id', memberId);

      if (error) throw error;

      // Se tem user_id e nome, atualizar o profile
      if (member.user_id && data.name) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name: data.name })
          .eq('id', member.user_id);

        if (profileError) {
          console.error('Erro ao atualizar profile:', profileError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Membro atualizado!');
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

  // Reenviar convite
  const resendInvite = useMutation({
    mutationFn: async ({ email, role, inviterName }: { email: string; role: string; inviterName?: string }) => {
      if (!organization) throw new Error('Organização não encontrada');
      if (!isAdmin) throw new Error('Sem permissão para reenviar convites');

      const { error: emailError } = await supabase.functions.invoke('send-team-invite', {
        body: {
          email,
          role,
          organizationName: organization.name,
          inviterName: inviterName || 'Um administrador',
        },
      });

      if (emailError) {
        throw new Error('Erro ao reenviar convite');
      }
    },
    onSuccess: () => {
      toast.success('Convite reenviado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Redefinir senha
  const resetPassword = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      if (!isAdmin) throw new Error('Sem permissão para redefinir senhas');

      const { data, error } = await supabase.functions.invoke('admin-update-user-password', {
        body: { targetUserId: userId, newPassword },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success('Senha redefinida com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Criar membro com senha
  const createMemberWithPassword = useMutation({
    mutationFn: async ({ email, password, name, role }: { email: string; password: string; name?: string; role: TeamRole }) => {
      if (!organization) throw new Error('Organização não encontrada');
      if (!isAdmin) throw new Error('Sem permissão para criar membros');

      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { 
          email, 
          password, 
          name,
          role,
          organizationId: organization.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Membro criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    members,
    isLoading,
    inviteMember,
    updateMemberRole,
    updateMemberPermissions,
    updateMember,
    removeMember,
    activateMember,
    resendInvite,
    resetPassword,
    createMemberWithPassword,
  };
}
