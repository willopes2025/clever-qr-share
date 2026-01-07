import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface MemberInstance {
  id: string;
  team_member_id: string;
  instance_id: string;
  created_at: string;
}

export const useMemberInstances = (teamMemberId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch instances assigned to a specific team member
  const { data: memberInstances, isLoading } = useQuery({
    queryKey: ['member-instances', teamMemberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_member_instances')
        .select('*')
        .eq('team_member_id', teamMemberId!);
      
      if (error) throw error;
      return data as MemberInstance[];
    },
    enabled: !!teamMemberId,
  });

  // Get instance IDs for a specific member - memoized to prevent unnecessary re-renders
  const memberInstanceIds = useMemo(
    () => memberInstances?.map(mi => mi.instance_id) || [],
    [memberInstances]
  );

  // Fetch current user's allowed instance IDs
  const { data: myInstanceIds } = useQuery({
    queryKey: ['my-instance-ids', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_member_instance_ids', { _user_id: user!.id });
      
      if (error) throw error;
      return data as string[];
    },
    enabled: !!user,
  });

  // Check if current user has instance restriction
  const { data: hasInstanceRestriction } = useQuery({
    queryKey: ['has-instance-restriction', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('member_has_instance_restriction', { _user_id: user!.id });
      
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user,
  });

  // Update member's instance assignments
  const updateMemberInstances = useMutation({
    mutationFn: async ({ memberId, instanceIds }: { memberId: string; instanceIds: string[] }) => {
      // First delete all existing assignments
      const { error: deleteError } = await supabase
        .from('team_member_instances')
        .delete()
        .eq('team_member_id', memberId);
      
      if (deleteError) throw deleteError;

      // Then insert new assignments
      if (instanceIds.length > 0) {
        const { error: insertError } = await supabase
          .from('team_member_instances')
          .insert(
            instanceIds.map(instanceId => ({
              team_member_id: memberId,
              instance_id: instanceId,
            }))
          );
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-instances'] });
      queryClient.invalidateQueries({ queryKey: ['my-instance-ids'] });
      queryClient.invalidateQueries({ queryKey: ['has-instance-restriction'] });
      toast.success('Instâncias de acesso atualizadas com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar instâncias: ${error.message}`);
    },
  });

  // Assign an instance to multiple members (used when creating a new instance)
  const assignInstanceToMembers = useMutation({
    mutationFn: async ({ instanceId, memberIds }: { instanceId: string; memberIds: string[] }) => {
      // If memberIds is empty, it means all members have access (no restriction)
      // So we don't need to insert any records
      if (memberIds.length === 0) {
        return;
      }

      // Insert assignments for each selected member
      const { error: insertError } = await supabase
        .from('team_member_instances')
        .insert(
          memberIds.map(memberId => ({
            team_member_id: memberId,
            instance_id: instanceId,
          }))
        );
      
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-instances'] });
      queryClient.invalidateQueries({ queryKey: ['my-instance-ids'] });
      queryClient.invalidateQueries({ queryKey: ['has-instance-restriction'] });
      toast.success('Permissões de acesso configuradas!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao configurar permissões: ${error.message}`);
    },
  });

  return {
    memberInstances,
    memberInstanceIds,
    myInstanceIds,
    hasInstanceRestriction,
    isLoading,
    updateMemberInstances,
    assignInstanceToMembers,
  };
};
