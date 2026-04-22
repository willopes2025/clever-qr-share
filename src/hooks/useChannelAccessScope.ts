import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useChannelAccessScope = () => {
  const { user } = useAuth();

  const { data: orgUserIds } = useQuery({
    queryKey: ['my-org-user-ids', user?.id],
    queryFn: async () => {
      const ids = new Set<string>();
      ids.add(user!.id);

      const { data: myMembership } = await supabase
        .from('team_members')
        .select('organization_id')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle();

      let orgId = myMembership?.organization_id as string | undefined;

      if (!orgId) {
        const { data: ownedOrg } = await supabase
          .from('organizations')
          .select('id')
          .eq('owner_id', user!.id)
          .maybeSingle();
        orgId = ownedOrg?.id;
      }

      if (orgId) {
        const { data: org } = await supabase
          .from('organizations')
          .select('owner_id')
          .eq('id', orgId)
          .maybeSingle();
        if (org?.owner_id) ids.add(org.owner_id);

        const { data: members } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('organization_id', orgId)
          .eq('status', 'active');

        members?.forEach((member) => {
          if (member.user_id) ids.add(member.user_id);
        });
      }

      return Array.from(ids);
    },
    enabled: !!user,
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

  return {
    orgUserIds,
    hasInstanceRestriction,
    allowedInstanceIds,
    hasMetaRestriction,
    allowedMetaNumberIds,
  };
};