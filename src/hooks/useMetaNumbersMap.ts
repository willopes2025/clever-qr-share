import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMemo } from "react";
import { useChannelAccessScope } from "@/hooks/useChannelAccessScope";

export interface MetaNumberInfo {
  phone_number_id: string;
  phone_number: string | null;
  display_name: string | null;
  waba_id: string | null;
}

export const useMetaNumbersMap = () => {
  const { user } = useAuth();
  const { orgUserIds, hasMetaRestriction, allowedMetaNumberIds } = useChannelAccessScope();

  const { data: metaNumbers = [], isLoading } = useQuery({
    queryKey: ['meta-whatsapp-numbers-map', user?.id, orgUserIds, hasMetaRestriction, allowedMetaNumberIds],
    queryFn: async () => {
      // Filtro defensivo no servidor: limita explicitamente a usuários da própria org.
      // Se orgUserIds estiver vazio (caso anômalo), retorna lista vazia em vez de tudo.
      if (!orgUserIds || orgUserIds.length === 0) {
        return [] as MetaNumberInfo[];
      }

      const { data, error } = await supabase
        .from('meta_whatsapp_numbers')
        .select('id, phone_number_id, phone_number, display_name, waba_id, user_id')
        .eq('is_active', true)
        .in('user_id', orgUserIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let rows = (data as (MetaNumberInfo & { id: string; user_id: string | null })[]) || [];
      // Defesa em camadas: mesmo com .in(), reaplica filtro local.
      const orgSet = new Set(orgUserIds);
      rows = rows.filter(r => r.user_id && orgSet.has(r.user_id));

      if (hasMetaRestriction && allowedMetaNumberIds) {
        const allowedSet = new Set(allowedMetaNumberIds);
        rows = rows.filter((row) => allowedSet.has(row.id));
      }

      return rows.map(({ id: _id, user_id, ...rest }) => rest) as MetaNumberInfo[];
    },
    enabled: !!user && orgUserIds !== undefined && (hasMetaRestriction === false || allowedMetaNumberIds !== undefined),
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
