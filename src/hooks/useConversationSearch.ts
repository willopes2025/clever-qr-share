import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useConversationSearch = (searchTerm: string) => {
  return useQuery({
    queryKey: ['conversation-search', searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 3) return [];

      // Sanitize wildcards to avoid breaking ILIKE
      const safe = searchTerm.trim().replace(/[%_]/g, " ");

      // IMPORTANTE: ordenar por mais recente e aumentar o limite.
      // Sem ORDER BY, o PostgREST retorna linhas arbitrárias e o LIMIT 100
      // pode descartar todas as mensagens relevantes do usuário (ex.: termos
      // muito comuns como "curso" que aparecem em centenas de mensagens).
      const { data, error } = await supabase
        .from('inbox_messages')
        .select('conversation_id, created_at')
        .ilike('content', `%${safe}%`)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (error) throw error;

      // Return unique conversation IDs (preserva ordem por recência)
      const seen = new Set<string>();
      const ids: string[] = [];
      for (const m of data ?? []) {
        if (m.conversation_id && !seen.has(m.conversation_id)) {
          seen.add(m.conversation_id);
          ids.push(m.conversation_id);
        }
      }
      return ids;
    },
    enabled: searchTerm.length >= 3,
    staleTime: 30000, // Cache por 30s
  });
};
