import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface MemberMetaNumber {
  id: string;
  team_member_id: string;
  meta_number_id: string;
  created_at: string;
}

export const useMemberMetaNumbers = (teamMemberId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: memberMetaNumbers, isLoading } = useQuery({
    queryKey: ['member-meta-numbers', teamMemberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_member_meta_numbers' as any)
        .select('*')
        .eq('team_member_id', teamMemberId!) as any;
      
      if (error) throw error;
      return (data || []) as MemberMetaNumber[];
    },
    enabled: !!teamMemberId,
  });

  const memberMetaNumberIds = useMemo(
    () => memberMetaNumbers?.map(mn => mn.meta_number_id) || [],
    [memberMetaNumbers]
  );

  const updateMemberMetaNumbers = useMutation({
    mutationFn: async ({ memberId, metaNumberIds }: { memberId: string; metaNumberIds: string[] }) => {
      const { error: deleteError } = await supabase
        .from('team_member_meta_numbers' as any)
        .delete()
        .eq('team_member_id', memberId);
      
      if (deleteError) throw deleteError;

      if (metaNumberIds.length > 0) {
        const { error: insertError } = await supabase
          .from('team_member_meta_numbers' as any)
          .insert(
            metaNumberIds.map(metaNumberId => ({
              team_member_id: memberId,
              meta_number_id: metaNumberId,
            }))
          );
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-meta-numbers'] });
      toast.success('Números Meta atualizados com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar números Meta: ${error.message}`);
    },
  });

  return {
    memberMetaNumbers,
    memberMetaNumberIds,
    isLoading,
    updateMemberMetaNumbers,
  };
};
