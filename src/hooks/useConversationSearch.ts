import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useConversationSearch = (searchTerm: string) => {
  return useQuery({
    queryKey: ['conversation-search', searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 3) return [];
      
      const { data, error } = await supabase
        .from('inbox_messages')
        .select('conversation_id')
        .ilike('content', `%${searchTerm}%`)
        .limit(100);
      
      if (error) throw error;
      
      // Return unique conversation IDs
      return [...new Set(data.map(m => m.conversation_id))];
    },
    enabled: searchTerm.length >= 3,
    staleTime: 30000, // Cache por 30s
  });
};
