import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Centralized access scope for channel-related resources (WhatsApp Lite instances
 * and Meta WhatsApp numbers). Resolves the user's organization deterministically
 * and exposes per-member restrictions when present.
 *
 * Returns undefined fields while loading so consumers can defer rendering and
 * avoid showing channels that don't belong to the active subscription.
 */
export const useChannelAccessScope = () => {
  const { user } = useAuth();

  // Step 1: Resolve the active organization ID for this user (membership first,
  // then ownership fallback). Single source of truth.
  const { data: organizationId, isLoading: isLoadingOrg } = useQuery({
    queryKey: ['my-active-org-id', user?.id],
    queryFn: async () => {
      const { data: myMembership } = await supabase
        .from('team_members')
        .select('organization_id')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle();

      if (myMembership?.organization_id) {
        return myMembership.organization_id as string;
      }

      const { data: ownedOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', user!.id)
        .maybeSingle();

      return (ownedOrg?.id as string | undefined) ?? null;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Step 2: Resolve every user_id that belongs to that organization (owner +
  // active members). Used to filter channel resources that are still partitioned
  // by user_id for legacy reasons.
  const { data: orgUserIds } = useQuery({
    queryKey: ['my-org-user-ids', user?.id, organizationId],
    queryFn: async () => {
      const ids = new Set<string>();
      ids.add(user!.id);

      if (organizationId) {
        const { data: org } = await supabase
          .from('organizations')
          .select('owner_id')
          .eq('id', organizationId)
          .maybeSingle();
        if (org?.owner_id) ids.add(org.owner_id);

        const { data: members } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('organization_id', organizationId)
          .eq('status', 'active');

        members?.forEach((member) => {
          if (member.user_id) ids.add(member.user_id);
        });
      }

      return Array.from(ids);
    },
    // Wait until the org lookup itself has settled so we never return a
    // user-only scope while the real org is still loading.
    enabled: !!user && !isLoadingOrg,
    staleTime: 60_000,
  });

  const { data: hasInstanceRestriction } = useQuery({
    queryKey: ['has-instance-restriction', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('member_has_instance_restriction', { _user_id: user!.id });
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user,
  });

  const { data: allowedInstanceIds } = useQuery({
    queryKey: ['my-instance-ids', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_member_instance_ids', { _user_id: user!.id });
      if (error) throw error;
      return data as string[];
    },
    enabled: !!user && hasInstanceRestriction === true,
  });

  const { data: hasMetaRestriction } = useQuery({
    queryKey: ['has-meta-restriction', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('member_has_meta_restriction', { _user_id: user!.id });
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user,
  });

  const { data: allowedMetaNumberIds } = useQuery({
    queryKey: ['my-meta-number-ids', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_member_meta_number_ids', { _user_id: user!.id });
      if (error) throw error;
      return data as string[];
    },
    enabled: !!user && hasMetaRestriction === true,
  });

  const isScopeReady =
    !!user &&
    organizationId !== undefined &&
    orgUserIds !== undefined &&
    hasInstanceRestriction !== undefined &&
    hasMetaRestriction !== undefined &&
    (hasInstanceRestriction === false || allowedInstanceIds !== undefined) &&
    (hasMetaRestriction === false || allowedMetaNumberIds !== undefined);

  return {
    organizationId: organizationId ?? null,
    orgUserIds,
    hasInstanceRestriction,
    allowedInstanceIds,
    hasMetaRestriction,
    allowedMetaNumberIds,
    isScopeReady,
  };
};
