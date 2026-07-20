import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Returns the list of user_ids that belong to the current user's organization
 * (owner + active team members). Falls back to the current user's id when the
 * RPC returns nothing so single-user setups keep working.
 */
export const useOrganizationMemberIds = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['organization-member-ids', user?.id],
    queryFn: async (): Promise<string[]> => {
      if (!user) return [];

      const { data, error } = await supabase.rpc('get_organization_member_ids', {
        _user_id: user.id,
      });

      if (error) throw error;

      const ids = ((data ?? []) as Array<string | { get_organization_member_ids: string }>)
        .map((row) =>
          typeof row === 'string' ? row : row?.get_organization_member_ids
        )
        .filter((id): id is string => !!id);

      if (!ids.includes(user.id)) ids.push(user.id);
      return ids;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};
