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

  const { data: metaNumbers = [], isLoading } = useQuery({
    queryKey: ['meta-whatsapp-numbers-map', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_whatsapp_numbers')
        .select('phone_number_id, phone_number, display_name, waba_id')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MetaNumberInfo[];
    },
    enabled: !!user,
    staleTime: 60000,
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
