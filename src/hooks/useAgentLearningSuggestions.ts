import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LearningSuggestion {
  id: string;
  agent_config_id: string;
  user_id: string;
  question: string;
  answer: string;
  suggested_title: string | null;
  source_conversation_id: string | null;
  analysis_date: string;
  confidence_score: number | null;
  category: string | null;
  frequency_count: number;
  status: string;
  dismissed_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export function useAgentLearningSuggestions(agentConfigId: string | null) {
  return useQuery({
    queryKey: ["agent-learning-suggestions", agentConfigId],
    queryFn: async () => {
      if (!agentConfigId) return [];

      const { data, error } = await supabase
        .from("ai_knowledge_suggestions")
        .select("*")
        .eq("agent_config_id", agentConfigId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LearningSuggestion[];
    },
    enabled: !!agentConfigId,
  });
}

export function useLearningSuggestionMutations() {
  const queryClient = useQueryClient();

  const approveSuggestion = useMutation({
    mutationFn: async ({ 
      suggestion, 
      editedTitle,
      editedContent 
    }: { 
      suggestion: LearningSuggestion; 
      editedTitle?: string;
      editedContent?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Create knowledge item from suggestion
      const title = editedTitle || suggestion.suggested_title || suggestion.question.slice(0, 50);
      const content = editedContent || `**Pergunta:** ${suggestion.question}\n\n**Resposta:** ${suggestion.answer}`;

      const { data: knowledgeItem, error: knowledgeError } = await supabase
        .from("ai_agent_knowledge_items")
        .insert({
          agent_config_id: suggestion.agent_config_id,
          user_id: user.id,
          title: title,
          content: content,
          source_type: "text",
          status: "processed",
        })
        .select()
        .single();

      if (knowledgeError) throw knowledgeError;

      // Update suggestion status
      const { error: updateError } = await supabase
        .from("ai_knowledge_suggestions")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", suggestion.id);

      if (updateError) throw updateError;

      return knowledgeItem;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["agent-learning-suggestions", variables.suggestion.agent_config_id] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-items", variables.suggestion.agent_config_id] });
      toast.success("Conhecimento adicionado à base!");
    },
    onError: (error) => {
      console.error("Error approving suggestion:", error);
      toast.error("Erro ao aprovar sugestão");
    },
  });

  const dismissSuggestion = useMutation({
    mutationFn: async ({ 
      suggestionId, 
      agentConfigId,
      reason 
    }: { 
      suggestionId: string; 
      agentConfigId: string;
      reason?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("ai_knowledge_suggestions")
        .update({
          status: "dismissed",
          dismissed_reason: reason || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", suggestionId);

      if (error) throw error;
      return { suggestionId, agentConfigId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agent-learning-suggestions", data.agentConfigId] });
      toast.success("Sugestão ignorada");
    },
    onError: (error) => {
      console.error("Error dismissing suggestion:", error);
      toast.error("Erro ao ignorar sugestão");
    },
  });

  const analyzeConversations = useMutation({
    mutationFn: async ({ agentConfigId, date }: { agentConfigId: string; date?: string }) => {
      const { data, error } = await supabase.functions.invoke("analyze-agent-learning", {
        body: { agentConfigId, date },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["agent-learning-suggestions", variables.agentConfigId] });
      if (data.suggestionsCount > 0) {
        toast.success(`${data.suggestionsCount} sugestões encontradas!`);
      } else {
        toast.info("Nenhuma nova sugestão encontrada");
      }
    },
    onError: (error: any) => {
      console.error("Error analyzing conversations:", error);
      const message = error?.message || "Erro ao analisar conversas";
      toast.error(message);
    },
  });

  return {
    approveSuggestion,
    dismissSuggestion,
    analyzeConversations,
  };
}
