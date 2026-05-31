import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConversationSearchSnippet {
  content: string;
  created_at: string;
}

export interface ConversationSearchResult {
  ids: string[];
  snippets: Record<string, ConversationSearchSnippet>;
}

export const useConversationSearch = (searchTerm: string) => {
  return useQuery<ConversationSearchResult>({
    queryKey: ['conversation-search', searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 3) return { ids: [], snippets: {} };

      // Sanitize wildcards to avoid breaking ILIKE
      const safe = searchTerm.trim().replace(/[%_]/g, " ");

      // IMPORTANTE: ordenar por mais recente e aumentar o limite.
      // Sem ORDER BY, o PostgREST retorna linhas arbitrárias e o LIMIT 100
      // pode descartar todas as mensagens relevantes do usuário (ex.: termos
      // muito comuns como "curso" que aparecem em centenas de mensagens).
      const { data, error } = await supabase
        .from('inbox_messages')
        .select('conversation_id, content, created_at')
        .ilike('content', `%${safe}%`)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (error) throw error;

      // Return unique conversation IDs (preserva ordem por recência).
      // Para cada conversa, guarda o trecho da mensagem mais recente
      // que casou com o termo — usado para preview estilo WhatsApp.
      const MAX_IDS = 800;
      const snippets: Record<string, ConversationSearchSnippet> = {};
      const ids: string[] = [];
      for (const m of data ?? []) {
        if (!m.conversation_id || snippets[m.conversation_id]) continue;
        snippets[m.conversation_id] = {
          content: m.content ?? "",
          created_at: m.created_at,
        };
        ids.push(m.conversation_id);
        if (ids.length >= MAX_IDS) break;
      }
      return { ids, snippets };
    },
    enabled: searchTerm.length >= 3,
    staleTime: 30000, // Cache por 30s
  });
};
