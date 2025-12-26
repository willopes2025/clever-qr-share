import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface MemberFunnel {
  id: string;
  team_member_id: string;
  funnel_id: string;
  created_at: string;
}

export const useMemberFunnels = (teamMemberId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch funnels assigned to a specific member
  const { data: memberFunnels, isLoading } = useQuery({
    queryKey: ['member-funnels', teamMemberId],
    queryFn: async () => {
      if (!teamMemberId) return [];
      
      const { data, error } = await supabase
        .from('team_member_funnels')
        .select('*')
        .eq('team_member_id', teamMemberId);

      if (error) throw error;
      return data as MemberFunnel[];
    },
    enabled: !!teamMemberId && !!user,
  });

  // Fetch current user's funnel restrictions
  const { data: myFunnelIds } = useQuery({
    queryKey: ['my-funnel-ids', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_member_funnel_ids', { _user_id: user!.id });
      
      if (error) throw error;
      return data as string[];
    },
    enabled: !!user,
  });

  // Check if current user has any funnel restrictions
  const { data: hasFunnelRestriction } = useQuery({
    queryKey: ['has-funnel-restriction', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('member_has_funnel_restriction', { _user_id: user!.id });
      
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user,
  });

  // Update member's funnel assignments
  const updateMemberFunnels = useMutation({
    mutationFn: async ({ teamMemberId, funnelIds }: { teamMemberId: string; funnelIds: string[] }) => {
      // Delete all current assignments
      const { error: deleteError } = await supabase
        .from('team_member_funnels')
        .delete()
        .eq('team_member_id', teamMemberId);

      if (deleteError) throw deleteError;

      // Insert new assignments (if any)
      if (funnelIds.length > 0) {
        const { error: insertError } = await supabase
          .from('team_member_funnels')
          .insert(funnelIds.map(funnelId => ({
            team_member_id: teamMemberId,
            funnel_id: funnelId,
          })));

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-funnels'] });
      queryClient.invalidateQueries({ queryKey: ['my-funnel-ids'] });
      queryClient.invalidateQueries({ queryKey: ['has-funnel-restriction'] });
      toast.success("Funis de acesso atualizados");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar funis: " + error.message);
    },
  });

  return {
    memberFunnels,
    memberFunnelIds: memberFunnels?.map(mf => mf.funnel_id) || [],
    myFunnelIds: myFunnelIds || [],
    hasFunnelRestriction: hasFunnelRestriction || false,
    isLoading,
    updateMemberFunnels,
  };
};
