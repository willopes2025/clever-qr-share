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

      // Sanitiza wildcards do ILIKE
      const safe = searchTerm.trim().replace(/[%_]/g, " ");

      // Usa RPC SECURITY DEFINER para evitar timeout do RLS por linha
      // (can_access_conversation roda dentro da função, sobre um conjunto
      // já dedupado por conversa). Retorna até 800 conversas, cada uma
      // com o trecho da mensagem mais recente que casou com o termo.
      const { data, error } = await supabase.rpc('search_inbox_messages', {
        _term: safe,
        _limit: 800,
      });

      if (error) throw error;

      const snippets: Record<string, ConversationSearchSnippet> = {};
      const ids: string[] = [];
      for (const row of (data ?? []) as Array<{
        conversation_id: string;
        content: string | null;
        created_at: string;
      }>) {
        if (!row.conversation_id || snippets[row.conversation_id]) continue;
        snippets[row.conversation_id] = {
          content: row.content ?? "",
          created_at: row.created_at,
        };
        ids.push(row.conversation_id);
      }
      return { ids, snippets };
    },
    enabled: searchTerm.length >= 3,
    staleTime: 30000,
  });
};
