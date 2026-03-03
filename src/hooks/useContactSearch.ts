import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useContactSearch = (searchTerm: string) => {
  return useQuery({
    queryKey: ['contact-search', searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 3) return [];

      const { data, error } = await supabase
        .from('conversations')
        .select('id, contacts!inner(name, phone, contact_display_id)')
        .or(
          `name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,contact_display_id.ilike.%${searchTerm}%`,
          { referencedTable: 'contacts' }
        )
        .limit(200);

      if (error) throw error;

      return data?.map(c => c.id) || [];
    },
    enabled: searchTerm.length >= 3,
    staleTime: 30000,
  });
};
