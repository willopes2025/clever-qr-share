import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Lightweight hook for creating a conversation, decoupled from the
 * heavy `useConversations()` query. Components that just need to start
 * a conversation (e.g. NewConversationDialog) should use this instead
 * of pulling in the full inbox list.
 */
export const useCreateConversation = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, instanceId }: { contactId: string; instanceId?: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("conversations")
        .upsert(
          {
            user_id: user.id,
            contact_id: contactId,
            instance_id: instanceId || null,
          },
          { onConflict: "user_id,contact_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"], refetchType: "active" });
      queryClient.invalidateQueries({ queryKey: ["unread-count"], refetchType: "active" });
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar conversa: " + error.message);
    },
  });
};
