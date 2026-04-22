import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMemo } from "react";

export interface MetaNumberInfo {
  phone_number_id: string;
  phone_number: string | null;
  display_name: string | null;
  waba_id: string | null;
}

export const useMetaNumbersMap = () => {
  const { user } = useAuth();

  // Resolver user_ids da organização do usuário logado para evitar vazamento
  // quando o RLS concede acesso amplo (ex.: admin do sistema).
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

        const { data: tms } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('organization_id', orgId)
          .eq('status', 'active');
        tms?.forEach(tm => { if (tm.user_id) ids.add(tm.user_id); });
      }

      return Array.from(ids);
    },
    enabled: !!user,
  });

  const { data: metaNumbers = [], isLoading } = useQuery({
    queryKey: ['meta-whatsapp-numbers-map', user?.id, orgUserIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_whatsapp_numbers')
        .select('phone_number_id, phone_number, display_name, waba_id, user_id')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let rows = data as (MetaNumberInfo & { user_id: string | null })[];
      if (orgUserIds && orgUserIds.length > 0) {
        const orgSet = new Set(orgUserIds);
        rows = rows.filter(r => r.user_id && orgSet.has(r.user_id));
      }
      return rows.map(({ user_id, ...rest }) => rest) as MetaNumberInfo[];
    },
    enabled: !!user && orgUserIds !== undefined,
    staleTime: 10000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const numbersMap = useMemo(() => {
    const map: Record<string, MetaNumberInfo> = {};
    metaNumbers.forEach((n) => {
      map[n.phone_number_id] = n;
    });
    return map;
  }, [metaNumbers]);

  const getLabel = (phoneNumberId: string | null | undefined): string | null => {
    if (!phoneNumberId) return null;
    const info = numbersMap[phoneNumberId];
    if (!info) return null;
    return info.display_name || info.phone_number || phoneNumberId;
  };

  return {
    metaNumbers,
    numbersMap,
    getLabel,
    isLoading,
  };
};
